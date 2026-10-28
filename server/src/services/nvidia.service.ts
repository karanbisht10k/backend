import { ENV } from '../config/env.js';

export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class NvidiaService {
  private apiKey: string;
  private modelName: string;
  private baseUrl: string;
  private embeddingModel: string;
  private dimension: number;

  constructor(options?: {
    apiKey?: string;
    modelName?: string;
    baseUrl?: string;
    embeddingModel?: string;
    dimension?: number;
  }) {
    this.apiKey = options?.apiKey || ENV.NVIDIA_API_KEY;
    this.modelName = options?.modelName || ENV.NVIDIA_MODEL;
    this.baseUrl = (options?.baseUrl || ENV.NVIDIA_BASE_URL).replace(/\/+$/, '');
    this.embeddingModel = options?.embeddingModel || ENV.NVIDIA_EMBEDDING_MODEL;
    this.dimension = options?.dimension || ENV.NVIDIA_EMBEDDING_DIMENSION;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModelName(): string {
    return this.modelName;
  }

  getEmbeddingModel(): string {
    return this.embeddingModel;
  }

  getDimension(): number {
    return this.dimension;
  }

  /**
   * Non-streaming Chat Completion (used for PR review synthesis and structured analysis)
   */
  async chatCompletion(params: {
    messages: ChatMessageParam[];
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('NVIDIA NIM API key is not configured. Please set NVIDIA_API_KEY in server/.env');
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.modelName,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 8192,
      temperature: params.temperature ?? 0.2,
      top_p: params.topP ?? 0.95,
      stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`NVIDIA NIM API error (${response.status}): ${errText}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content;
      if (content === undefined || content === null) {
        throw new Error('Malformed NVIDIA NIM response: missing content in choice[0]');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Streaming Chat Completion over SSE (used for CodeSense Copilot live chat)
   */
  async streamChat(params: {
    messages: ChatMessageParam[];
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    onToken: (token: string) => void;
    isAborted?: () => boolean;
  }): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('NVIDIA NIM API key is not configured. Please set NVIDIA_API_KEY in server/.env');
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = {
      model: this.modelName,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 8192,
      temperature: params.temperature ?? 0.6,
      top_p: params.topP ?? 0.95,
      stream: true
    };

    const controller = new AbortController();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA NIM streaming error (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null, cannot stream tokens.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullAnswer = '';

    try {
      while (true) {
        if (params.isAborted && params.isAborted()) {
          controller.abort();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const deltaToken = parsed.choices?.[0]?.delta?.content;
            if (deltaToken) {
              fullAnswer += deltaToken;
              params.onToken(deltaToken);
            }
          } catch {
            // Ignore incomplete chunk parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullAnswer;
  }

  /**
   * Generates embeddings for source-code chunks using NVIDIA NIM embeddings API
   */
  async embedCodeChunks(
    chunks: Array<{ text: string; title?: string } | string>,
    inputType: 'passage' | 'document' | 'query' = 'passage'
  ): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error('NVIDIA NIM API key is not configured. Please set NVIDIA_API_KEY in server/.env');
    }
    if (!chunks.length) return [];

    const normalizedTexts = chunks.map((c) => (typeof c === 'string' ? c : c.text));
    const endpoint = `${this.baseUrl}/embeddings`;
    const batchSize = 16;
    const results: number[][] = [];
    const effectiveInputType = (inputType === 'document' || inputType === 'passage') ? 'passage' : 'query';

    for (let i = 0; i < normalizedTexts.length; i += batchSize) {
      const batch = normalizedTexts.slice(i, i + batchSize);
      // Truncate overly long text snippets to stay safely within token limits
      const safeBatch = batch.map((text) => (text.length > 8000 ? text.substring(0, 8000) : text || ' '));

      let attempts = 0;
      let success = false;
      let lastError: any = null;

      while (attempts < 3 && !success) {
        attempts++;
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              input: safeBatch,
              model: this.embeddingModel,
              input_type: effectiveInputType
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`NVIDIA embeddings error (${response.status}): ${errText}`);
          }

          const json: any = await response.json();
          if (json && Array.isArray(json.data)) {
            const batchEmbeddings = json.data.map((item: any) => item.embedding);
            results.push(...batchEmbeddings);
            success = true;
          } else {
            throw new Error('Malformed NVIDIA embeddings response format');
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`⚠️ [NVIDIA Embedding] Batch ${i / batchSize + 1} attempt ${attempts} failed: ${err.message}`);
          if (attempts < 3) {
            await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempts - 1)));
          }
        }
      }

      if (!success) {
        throw new Error(`NVIDIA embeddings failed for batch starting at index ${i}: ${lastError?.message}`);
      }
    }

    return results;
  }

  /**
   * Embeds a search query or user prompt for vector similarity retrieval
   */
  async embedQuery(query: string): Promise<number[]> {
    const results = await this.embedCodeChunks([query], 'query');
    if (!results.length || !results[0]) {
      throw new Error('Failed to generate query vector with NVIDIA NIM');
    }
    return results[0];
  }
}

export const nvidiaService = new NvidiaService();
