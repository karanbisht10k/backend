import { ENV } from '../config/env.js';
import { geminiEmbeddingService } from './geminiEmbedding.service.js';
import { voyageService } from './voyage.service.js';
import { nvidiaService } from './nvidia.service.js';

export interface CodeEmbeddingItem {
  text: string;
  title?: string;
}

export class EmbeddingService {
  /**
   * Returns whether the active embedding provider has its API key configured
   */
  isConfigured(): boolean {
    if (ENV.EMBEDDING_PROVIDER === 'nvidia') {
      return nvidiaService.isConfigured();
    }
    if (ENV.EMBEDDING_PROVIDER === 'gemini') {
      return geminiEmbeddingService.isConfigured();
    }
    return voyageService.isConfigured();
  }

  getActiveProvider(): string {
    return ENV.EMBEDDING_PROVIDER;
  }

  getProvider(): string {
    return this.getActiveProvider();
  }

  getActiveModel(): string {
    return ENV.EFFECTIVE_EMBEDDING_MODEL;
  }

  getModel(): string {
    return this.getActiveModel();
  }

  getActiveDimension(): number {
    return ENV.EFFECTIVE_EMBEDDING_DIMENSION;
  }

  getDimension(): number {
    return this.getActiveDimension();
  }

  /**
   * Generates embeddings for source code chunks using the configured provider
   */
  async embedCodeChunks(
    chunks: Array<CodeEmbeddingItem | string>,
    inputType: 'document' | 'query' = 'document'
  ): Promise<number[][]> {
    if (ENV.EMBEDDING_PROVIDER === 'nvidia') {
      return nvidiaService.embedCodeChunks(chunks, inputType);
    }
    if (ENV.EMBEDDING_PROVIDER === 'gemini') {
      return geminiEmbeddingService.embedCodeChunks(chunks, inputType);
    }
    const texts = chunks.map((c) => (typeof c === 'string' ? c : c.text));
    return voyageService.embedCodeChunks(texts, inputType);
  }

  /**
   * Generates a single vector embedding for a search or user question query
   */
  async embedQuery(query: string): Promise<number[]> {
    if (ENV.EMBEDDING_PROVIDER === 'nvidia') {
      return nvidiaService.embedQuery(query);
    }
    if (ENV.EMBEDDING_PROVIDER === 'gemini') {
      return geminiEmbeddingService.embedQuery(query);
    }
    return voyageService.embedQuery(query);
  }
}

export const embeddingService = new EmbeddingService();
