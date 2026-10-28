import { embeddingService } from '../services/embedding.service.js';
import { geminiService } from '../services/gemini.service.js';
import { nvidiaService } from '../services/nvidia.service.js';
import { ENV } from '../config/env.js';

async function main() {
  console.log('--- NVIDIA NIM Configuration ---');
  console.log('AI Provider:', ENV.AI_PROVIDER);
  console.log('Chat Model:', nvidiaService.getModelName());
  console.log('Embedding Provider:', embeddingService.getActiveProvider());
  console.log('Embedding Model:', embeddingService.getActiveModel());
  console.log('Embedding Dimension:', embeddingService.getActiveDimension());
  console.log('NVIDIA Configured:', nvidiaService.isConfigured());

  console.log('\n--- 1. Testing Code Chunk Embeddings ---');
  const chunks = [
    'export class AuthService { login() { return true; } }',
    'export class DatabasePool { connect() { return null; } }'
  ];
  const embeddings = await embeddingService.embedCodeChunks(chunks);
  console.log(`✅ Embedded ${embeddings.length} chunks. Dimensions: ${embeddings[0].length}, ${embeddings[1].length}`);

  console.log('\n--- 2. Testing Query Embedding ---');
  const queryVec = await embeddingService.embedQuery('How to authenticate a user?');
  console.log(`✅ Query vector generated. Dimension: ${queryVec.length}`);

  console.log('\n--- 3. Testing Chat Streaming with Minimax ---');
  let receivedTokens = '';
  const result = await geminiService.streamChat({
    question: 'Briefly describe AuthService in one sentence.',
    contextChunks: [{
      id: 'chunk-1',
      repositoryId: 'demo-repo',
      filePath: 'src/auth.ts',
      startLine: 1,
      endLine: 5,
      symbolName: 'AuthService',
      symbolType: 'class',
      language: 'typescript',
      content: 'export class AuthService { login() { return true; } }',
      commitSha: 'c123456'
    }],
    onToken: (t) => {
      receivedTokens += t;
      process.stdout.write(t);
    }
  });

  console.log(`\n\n✅ Streaming finished! Total token chars: ${receivedTokens.length}, Citations: ${result.citations.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Pipeline Test Failed:', err);
  process.exit(1);
});
