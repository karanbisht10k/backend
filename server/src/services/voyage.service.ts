import axios from 'axios';
import { ENV } from '../config/env.js';

/**
 * @deprecated Legacy Voyage AI embedding provider.
 * CodeSense is standardized on a Gemini-only architecture using gemini-embedding-2.
 * This class is preserved only for backward compatibility and is not called in active workflows.
 */
export class VoyageEmbeddingService {
  private apiKey: string;
  private model: string;
  private dimension: number;

  constructor() {
    this.apiKey = ENV.VOYAGE_API_KEY;
    this.model = ENV.VOYAGE_MODEL;
    this.dimension = ENV.VOYAGE_DIMENSION;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Embeds multiple code or text chunks using Voyage AI
   */
  async embedCodeChunks(texts: string[], inputType: 'document' | 'query' = 'document'): Promise<number[][]> {
    if (!texts.length) return [];

    if (!this.isConfigured()) {
      console.warn('ℹ️  [Voyage AI] VOYAGE_API_KEY not configured. Generating high-entropy deterministic embeddings.');
      return texts.map((t) => this.generateDeterministicEmbedding(t, this.dimension));
    }

    try {
      const batchSize = 64; // Voyage batch limit safe ceiling
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize).map((t) => (t.length > 8000 ? t.substring(0, 8000) : t));

        const response = await axios.post(
          'https://api.voyageai.com/v1/embeddings',
          {
            input: batch,
            model: this.model,
            input_type: inputType
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`
            },
            timeout: 30000
          }
        );

        if (response.data && response.data.data) {
          const sorted = response.data.data.sort((a: any, b: any) => a.index - b.index);
          for (const item of sorted) {
            results.push(item.embedding);
          }
        } else {
          throw new Error('Unexpected Voyage AI response structure');
        }
      }

      return results;
    } catch (err: any) {
      console.error('❌ [Voyage AI] Embedding API error:', err.response?.data || err.message);
      // Fallback to deterministic pseudo-embeddings so pipeline does not break
      return texts.map((t) => this.generateDeterministicEmbedding(t, this.dimension));
    }
  }

  /**
   * Embed a single search query
   */
  async embedQuery(query: string): Promise<number[]> {
    const embeddings = await this.embedCodeChunks([query], 'query');
    return embeddings[0] || new Array(this.dimension).fill(0);
  }

  /**
   * Generates a deterministic normalized unit vector for testing when API key is pending
   */
  private generateDeterministicEmbedding(text: string, dim: number): number[] {
    const vector = new Array(dim).fill(0);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 33) ^ text.charCodeAt(i);
      const idx = Math.abs((hash + i * 17) % dim);
      vector[idx] += ((hash & 0xff) / 255.0 - 0.5) * 2.0;
    }

    // Normalize to unit length for cosine similarity
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

export const voyageService = new VoyageEmbeddingService();
