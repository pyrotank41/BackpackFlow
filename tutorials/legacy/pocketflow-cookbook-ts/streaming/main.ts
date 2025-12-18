import { Node, Flow } from 'pocketflow';
import { streamLLMResponse, demoStreamResponse } from './utils';
import * as readline from 'readline';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SharedState {
  messages: Message[];
  interrupted: boolean;
  useDemo: boolean;
  prompt?: string;
}

interface StreamResult {
  content: string;
  interrupted: boolean;
  charCount: number;
  duration: number;
}

/**
 * StreamNode - Handles real-time LLM streaming with interruption capabilities
 */
class StreamNode extends Node<SharedState> {
  private rl: readline.Interface;
  private interrupted: boolean = false;

  constructor() {
    super();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async prep(shared: SharedState): Promise<{ messages: Message[], prompt: string } | null> {
    // First time setup
    if (!shared.messages || shared.messages.length === 0) {
      console.log('🌊 PocketFlow LLM Streaming Chatbot');
      console.log('==================================\n');

      // Check if we have a prompt from command line args
      const args = process.argv.slice(2);
      const demoMode = args.includes('--demo');
      let prompt = args.find(arg => !arg.startsWith('--')) || '';

      // Set demo mode
      shared.useDemo = demoMode;

      // Get initial prompt from user if not provided
      if (!prompt) {
        prompt = await this.getUserInput(`💬 Start the conversation: `);
      }

      if (shared.useDemo) {
        console.log('🎭 Demo mode: Using simulated streaming');
      } else {
        console.log('🤖 Real mode: Using OpenAI streaming API');
      }

      // Initialize shared state with first message
      shared.messages = [{ role: 'user', content: prompt }];
      shared.interrupted = false;
      shared.prompt = prompt;

      // Setup interrupt listener once
      this.setupInterruptListener(shared);

      return { messages: shared.messages, prompt };
    } else {
      // Ongoing conversation - get next user input
      const userInput = await this.getUserInput(`\n💬 You: `);
      
      // Check if user wants to exit
      if (userInput.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        this.cleanup();
        return null;
      }

      // Add user message to conversation
      shared.messages.push({ role: 'user', content: userInput });
      
      return { messages: shared.messages, prompt: userInput };
    }
  }

  async exec(prepData: { messages: Message[], prompt: string } | null): Promise<StreamResult | null> {
    if (!prepData) return null;

    const { messages, prompt } = prepData;
    let fullContent = '';
    let charCount = 0;
    const startTime = Date.now();

    console.log('\n🤖 Streaming response... (Press ENTER to interrupt)');
    console.log('┌─────────────────────────────────────────────┐');

    // Get shared state from the current execution context
    // Since exec doesn't have direct access to shared state, we'll check args for demo mode
    const args = process.argv.slice(2);
    const isDemoMode = args.includes('--demo');

    try {
      // Choose streaming method based on demo mode
      const streamMethod = isDemoMode ? demoStreamResponse : streamLLMResponse;
      const input = isDemoMode ? prompt : messages;

      fullContent = await streamMethod(input as any, {
        onChunk: (chunk: string) => {
          if (!this.interrupted) {
            process.stdout.write(chunk);
            charCount += chunk.length;
          }
        },
        shouldStop: () => this.interrupted,
        onError: (error: Error) => {
          console.log(`\n❌ Streaming error: ${error.message}`);
        }
      });

      const duration = (Date.now() - startTime) / 1000;

      return {
        content: fullContent,
        interrupted: this.interrupted,
        charCount,
        duration
      };

    } catch (error) {
      console.log(`\n❌ Error during streaming: ${(error as Error).message}`);
      return {
        content: '',
        interrupted: true,
        charCount: 0,
        duration: (Date.now() - startTime) / 1000
      };
    }
  }

  async post(shared: SharedState, prepRes: any, execRes: StreamResult | null): Promise<string | undefined> {
    console.log('\n└─────────────────────────────────────────────┘');

    if (!execRes) {
      console.log('\n👋 Goodbye!');
      this.cleanup();
      return undefined;
    }

    // Display results
    if (execRes.interrupted) {
      console.log('\n🛑 Stream interrupted by user');
      console.log(`📊 Partial stats: ${execRes.charCount} characters in ${execRes.duration.toFixed(1)} seconds`);
    } else {
      console.log('\n✅ Stream completed successfully!');
      console.log(`📊 Stats: ${execRes.charCount} characters streamed in ${execRes.duration.toFixed(1)} seconds`);
    }

    // Add response to conversation history
    if (execRes.content) {
      shared.messages.push({
        role: 'assistant',
        content: execRes.content
      });
    }

    // Reset interrupt flag for next round and continue chatting
    this.interrupted = false;
    shared.interrupted = false;
    
    return 'continue';
  }

  private setupInterruptListener(shared: SharedState): void {
    this.rl.on('line', () => {
      if (!this.interrupted) {
        this.interrupted = true;
        shared.interrupted = true;
        console.log('\n🛑 Interrupt signal received...');
      }
    });
  }

  private async getUserInput(question: string, defaultValue?: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue || '');
      });
    });
  }


  private cleanup(): void {
    this.rl.removeAllListeners();
    this.rl.close();
  }

  private getSharedState(): SharedState | undefined {
    // This is a helper to access shared state during execution
    // In a real implementation, you'd pass this through the execution context
    return undefined; // Will be overridden by actual shared state
  }

  /**
   * Public API method for programmatic usage
   */
  async streamResponse(prompt: string, options: {
    onInterrupt?: () => void;
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    useDemo?: boolean;
  } = {}): Promise<string> {
    let fullContent = '';
    let charCount = 0;
    const startTime = Date.now();
    this.interrupted = false;

    // Setup interrupt handler if provided
    if (options.onInterrupt) {
      this.rl.on('line', () => {
        this.interrupted = true;
        options.onInterrupt!();
      });
    }

    try {
      // Choose streaming method based on demo mode
      const streamMethod = options.useDemo ? demoStreamResponse : streamLLMResponse;
      const input = options.useDemo ? prompt : [{ role: 'user' as const, content: prompt }];

      fullContent = await streamMethod(input as any, {
        onChunk: (chunk: string) => {
          if (!this.interrupted) {
            charCount += chunk.length;
            if (options.onChunk) {
              options.onChunk(chunk);
            }
          }
        },
        shouldStop: () => this.interrupted,
        onComplete: (text: string) => {
          if (options.onComplete) {
            options.onComplete(text);
          }
        }
      });

      return fullContent;
    } catch (error) {
      console.error('Streaming error:', error);
      return '';
    } finally {
      // Clean up interrupt listener
      this.rl.removeAllListeners('line');
    }
  }
}

// Create the flow
const streamNode = new StreamNode();
streamNode.on("continue", streamNode); // Loop back for multiple prompts

const flow = new Flow(streamNode);

// Main execution
async function main() {
  try {
    const shared: SharedState = {
      messages: [],
      interrupted: false,
      useDemo: false
    };

    await flow.run(shared);
  } catch (error) {
    console.error('\n❌ Error running streaming demo:', error);
    process.exit(1);
  }
}

// Export for programmatic usage
export { StreamNode, main };

// Run if executed directly
if (require.main === module) {
  main();
}