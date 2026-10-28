import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { ENV } from '../config/env.js';

export interface CodeChunkInput {
  text: string;
  title?: string;
}

export class GeminiEmbeddingService {
  private genAI: GoogleGenerativeAI | any = null;
  private modelName: string;
  private dimension: number;
  private configured: boolean = false;

  constructor(options?: {
    apiKey?: string;
    modelName?: string;
    dimension?: number;
    clientOverride?: any;
  }) {
    this.modelName = options?.modelName || ENV.GEMINI_EMBEDDING_MODEL;
    this.dimension = options?.dimension || ENV.GEMINI_EMBEDDING_DIMENSION;

    if (options?.clientOverride) {
      this.genAI = options.clientOverride;
      this.configured = true;
    } else {
      const key = options?.apiKey !== undefined ? options.apiKey : ENV.GEMINI_API_KEY;
      if (key && key.trim().length > 0) {
        this.genAI = new GoogleGenerativeAI(key);
        this.configured = true;
      }
    }
  }

  isConfigured(): boolean {
    return this.configured && this.genAI !== null;
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * Embeds multiple source-code chunks using official Gemini API batchEmbedContents
   */
  async embedCodeChunks(
    chunks: Array<CodeChunkInput | string>,
    inputType: 'document' | 'query' = 'document'
  ): Promise<number[][]> {
    if (!chunks.length) return [];

    // Normalize inputs
    const normalizedChunks: CodeChunkInput[] = chunks.map((c) => {
      if (typeof c === 'string') {
        return { text: c };
      }
      return c;
    });

    if (!this.isConfigured() || !this.genAI) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env to generate genuine embeddings.');
    }

    const taskType = inputType === 'query' ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT;
    const batchSize = 64; // Safe ceiling within Gemini's 100-request limit
    const results: number[][] = [];

    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    for (let i = 0; i < normalizedChunks.length; i += batchSize) {
      const batch = normalizedChunks.slice(i, i + batchSize);
      const batchEmbeddings = await this.embedBatchWithRetry(model, batch, taskType);
      results.push(...batchEmbeddings);
    }

    return results;
  }

  /**
   * Embed a single search or question query using Gemini embedContent
   */
  async embedQuery(query: string): Promise<number[]> {
    if (!this.isConfigured() || !this.genAI) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in server/.env to generate query embeddings.');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      const safeText = query.length > 8000 ? query.substring(0, 8000) : query;
      const response = await model.embedContent({
        content: {
          role: 'user',
          parts: [{ text: safeText || 'query' }]
        },
        taskType: TaskType.RETRIEVAL_QUERY,
        outputDimensionality: this.dimension
      });

      if (response && response.embedding && Array.isArray(response.embedding.values)) {
        const values = response.embedding.values;
        if (values.length === this.dimension) {
          return values;
        } else if (values.length > this.dimension) {
          return values.slice(0, this.dimension);
        } else {
          const padded = new Array(this.dimension).fill(0);
          for (let k = 0; k < values.length; k++) padded[k] = values[k];
          return padded;
        }
      }
      throw new Error('Malformed Gemini embedContent response structure');
    } catch (err: any) {
      console.error(`❌ [Gemini Embedding] Query embedding failed: ${err.message}`);
      throw new Error(`Gemini query embedding failed: ${err.message}`);
    }
  }

  /**
   * Executes batch embedding with transient error handling, exponential backoff, and dimension validation
   */
  private async embedBatchWithRetry(
    model: any,
    batch: CodeChunkInput[],
    taskType: TaskType,
    maxRetries = 3
  ): Promise<number[][]> {
    const sanitizedRequests = batch.map((item) => {
      // Safe truncation to avoid oversized payload rejections
      const safeText = item.text.length > 8000 ? item.text.substring(0, 8000) : item.text;
      return {
        content: {
          role: 'user',
          parts: [{ text: safeText || '// empty code chunk' }]
        },
        taskType,
        title: item.title ? item.title.substring(0, 100) : undefined,
        outputDimensionality: this.dimension
      };
    });

    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        const response = await model.batchEmbedContents({
          requests: sanitizedRequests
        });

        if (response && Array.isArray(response.embeddings)) {
          const embeddings = response.embeddings.map((emb: any) => {
            const values = emb.values || [];
            // If outputDimensionality was applied or standard 768
            if (values.length === this.dimension) {
              return values;
            } else if (values.length > this.dimension) {
              return values.slice(0, this.dimension);
            } else {
              // Pad if dimension is shorter
              const padded = new Array(this.dimension).fill(0);
              for (let k = 0; k < values.length; k++) padded[k] = values[k];
              return padded;
            }
          });

          return embeddings;
        }

        throw new Error('Malformed Gemini batchEmbedContents response structure');
      } catch (err: any) {
        attempt++;
        const isRateLimit = err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
        const isTransient = isRateLimit || err.status >= 500 || err.message?.includes('fetch failed');

        if (isTransient && attempt < maxRetries) {
          console.warn(`⚠️ [Gemini Embedding] Transient error (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
        } else {
          console.error(`❌ [Gemini Embedding] Batch embedding failed after attempt ${attempt}:`, err.message);
          throw new Error(`Gemini batch embedding API failed after ${attempt} attempts: ${err.message}`);
        }
      }
    }

    throw new Error(`Gemini batch embedding API failed after ${attempt} attempts.`);
  }

  /**
   * Deterministic unit vector generation for test mode or offline fallback
   */
  generateDeterministicEmbedding(text: string, dim: number): number[] {
    const vector = new Array(dim).fill(0);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33) ^ text.charCodeAt(i);
      const idx = Math.abs((hash + i * 17) % dim);
      vector[idx] += ((hash & 0xff) / 255.0 - 0.5) * 2.0;
    }

    // Normalize to unit length (L2 norm) for cosine similarity
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }
}

export const geminiEmbeddingService = new GeminiEmbeddingService();
