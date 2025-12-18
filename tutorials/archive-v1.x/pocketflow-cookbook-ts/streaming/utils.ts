import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  shouldStop?: () => boolean;
}

/**
 * Stream LLM response in real-time using OpenAI's streaming API
 */
export async function streamLLMResponse(
  messages: Message[], 
  options: StreamOptions = {}
): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
  });
  
  let fullResponse = '';
  
  try {
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    });

    for await (const chunk of stream) {
      // Check if we should stop streaming
      if (options.shouldStop && options.shouldStop()) {
        break;
      }

      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        if (options.onChunk) {
          options.onChunk(content);
        }
      }
    }

    if (options.onComplete) {
      options.onComplete(fullResponse);
    }

    return fullResponse;
  } catch (error) {
    const err = error as Error;
    if (options.onError) {
      options.onError(err);
    }
    throw err;
  }
}

/**
 * Demo streaming with fake chunks (for testing without API key)
 */
export async function demoStreamResponse(
  prompt: string,
  options: StreamOptions = {}
): Promise<string> {
  const demoText = `Here's a demo response to your prompt: "${prompt}"\n\nThis is a simulated streaming response that demonstrates how the real streaming would work. Each character appears progressively, just like it would with a real LLM response. You can press ENTER at any time to interrupt this demo stream.\n\nThe streaming system is designed to be responsive and handle interruptions gracefully. This makes it perfect for interactive applications where users might want to stop long responses early.`;
  
  let fullResponse = '';
  
  for (let i = 0; i < demoText.length; i++) {
    // Check if we should stop streaming
    if (options.shouldStop && options.shouldStop()) {
      break;
    }

    const char = demoText[i];
    fullResponse += char;
    
    if (options.onChunk) {
      options.onChunk(char);
    }
    
    // Add small delay to simulate real streaming
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  if (options.onComplete) {
    options.onComplete(fullResponse);
  }
  
  return fullResponse;
}

/**
 * Simple non-streaming LLM call for comparison
 */
export async function callLLM(messages: Message[]): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
  });
  
  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    temperature: 0.7
  });
  
  return response.choices[0].message.content || '';
}

// Test functions
async function testStreaming() {
  console.log('🧪 Testing streaming functionality...\n');
  
  const messages: Message[] = [
    { role: 'user', content: 'Write a short poem about TypeScript' }
  ];
  
  console.log('📝 Prompt:', messages[0].content);
  console.log('\n🌊 Streaming response:');
  console.log('┌─────────────────────────────────────────────┐');
  
  let charCount = 0;
  const startTime = Date.now();
  
  try {
    await streamLLMResponse(messages, {
      onChunk: (chunk) => {
        process.stdout.write(chunk);
        charCount += chunk.length;
      },
      onComplete: (fullText) => {
        const duration = (Date.now() - startTime) / 1000;
        console.log('\n└─────────────────────────────────────────────┘');
        console.log(`\n✅ Stream completed!`);
        console.log(`📊 Stats: ${charCount} characters streamed in ${duration.toFixed(1)} seconds`);
      },
      onError: (error) => {
        console.log('\n└─────────────────────────────────────────────┘');
        console.log(`\n❌ Error: ${error.message}`);
      }
    });
  } catch (error) {
    console.log('\n└─────────────────────────────────────────────┘');
    console.log(`\n❌ Error: ${(error as Error).message}`);
  }
}

async function testDemo() {
  console.log('🎭 Testing demo mode...\n');
  
  console.log('📝 Demo prompt: "Explain quantum computing"');
  console.log('\n🌊 Demo streaming response:');
  console.log('┌─────────────────────────────────────────────┐');
  
  let charCount = 0;
  const startTime = Date.now();
  
  await demoStreamResponse('Explain quantum computing', {
    onChunk: (chunk) => {
      process.stdout.write(chunk);
      charCount += chunk.length;
    },
    onComplete: () => {
      const duration = (Date.now() - startTime) / 1000;
      console.log('\n└─────────────────────────────────────────────┘');
      console.log(`\n✅ Demo completed!`);
      console.log(`📊 Stats: ${charCount} characters streamed in ${duration.toFixed(1)} seconds`);
    }
  });
}

// Run tests if this file is executed directly
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--demo')) {
    await testDemo();
  } else {
    await testStreaming();
  }
}

if (require.main === module) {
  main().catch(console.error);
}