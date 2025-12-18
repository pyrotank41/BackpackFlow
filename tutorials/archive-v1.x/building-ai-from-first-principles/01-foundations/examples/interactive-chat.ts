/**
 * Interactive Terminal Chat - Complete Chat Behavior
 * 
 * 🎯 This builds on chat-completion.ts to show a real interactive chatbot.
 * 
 * Key Learnings:
 * • Same ChatNode works for both single interactions and ongoing conversations
 * • SharedStorage accumulates conversation history automatically
 * • The prep→exec→post pattern scales without modification
 * • Error handling becomes crucial for user-facing applications
 * 
 * Features Demonstrated:
 * • Persistent conversation history using SharedStorage
 * • Interactive terminal interface with readline
 * • Commands like history, clear, exit
 * • Graceful error handling and user experience
 * • Real-time typing indicators
 * 
 * 🚀 Run: npx tsx terminal-chat.ts
 * 🔧 Debug: DEBUG_CHAT=true npx tsx terminal-chat.ts
 */

import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import * as readline from 'readline';
import { Node, Flow } from '../../../../src/pocketflow';
import OpenAI from 'openai';

// Types (same as chat-completion.ts)
type Message = {
    role: 'user' | 'assistant';
    content: string;
}

type SharedStorage = {
    messages: Message[];
}

// Helper function to call OpenAI API (enhanced version with error handling)
async function callLLM(messages: Message[]): Promise<string> {
    // 🔐 Check for API key first - prevent confusing errors later
    if (!process.env.OPENAI_API_KEY) {
        throw new Error(`
🚨 OpenAI API key not found! 
📝 Create a .env file with: OPENAI_API_KEY=your-key-here
🔗 Get your key at: https://platform.openai.com/api-keys
        `);
    }

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
        });
        
        // 🛡️ Always check if we got a response
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI returned empty response');
        }
        
        return content;
    } catch (error) {
        // 🔄 Provide helpful error messages for common issues
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('Invalid API key - please check your .env file');
            }
            if (error.message.includes('quota')) {
                throw new Error('OpenAI quota exceeded - check your billing');
            }
        }
        throw error; // Re-throw other errors
    }
}

// PocketFlow Node (same as chat-completion.ts)
class ChatNode extends Node<SharedStorage> {
    constructor(private userMessage: string) {
        super();
    }

    async prep(shared: SharedStorage): Promise<Message[]> {
        shared.messages.push({ role: 'user', content: this.userMessage });
        return shared.messages;
    }
    
    async exec(messages: Message[]): Promise<string> {
        const response = await callLLM(messages);
        return response;
    }
    
    async post(shared: SharedStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string 
        });
        return undefined;
    }
}

// PocketFlow Flow (same as chat-completion.ts)
class ChatFlow extends Flow<SharedStorage> {
    constructor(userMessage: string) {
        const chatNode = new ChatNode(userMessage);
        super(chatNode);
    }
}

// Utility function (same as chat-completion.ts)
async function sendMessage(shared: SharedStorage, message: string): Promise<string> {
    const flow = new ChatFlow(message);
    await flow.run(shared);
    
    const lastMessage = shared.messages[shared.messages.length - 1];
    return lastMessage.role === 'assistant' ? lastMessage.content : '';
}

class TerminalChat {
    private rl: readline.Interface;
    private shared: SharedStorage;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.shared = { messages: [] };
    }

    private formatMessage(role: 'user' | 'assistant', content: string): string {
        const prefix = role === 'user' ? '👤 You' : '🤖 AI';
        const color = role === 'user' ? '\x1b[36m' : '\x1b[32m'; // Cyan for user, Green for AI
        const reset = '\x1b[0m';
        return `${color}${prefix}: ${content}${reset}`;
    }

    private showWelcome(): void {
        console.log('\n🚀 Welcome to PocketFlow Terminal Chat!');
        console.log('💬 Type your messages and press Enter to chat with AI');
        console.log('🔚 Type "exit", "quit", or "bye" to end the conversation');
        console.log('📜 Type "history" to see the full conversation');
        console.log('🧹 Type "clear" to clear the conversation history');
        console.log('🎓 Community & help: see ../JOIN_COMMUNITY.md');
        console.log('-'.repeat(50));
        console.log('🧠 Same ChatNode, persistent conversations - simple ideas stacked together!');
        console.log('-'.repeat(50));
    }

    private showHistory(): void {
        if (this.shared.messages.length === 0) {
            console.log('📭 No conversation history yet. Start chatting!');
            return;
        }

        console.log('\n📜 Conversation History:');
        console.log('-'.repeat(30));
        this.shared.messages.forEach((msg, index) => {
            console.log(`${index + 1}. ${this.formatMessage(msg.role, msg.content)}`);
        });
        console.log('-'.repeat(30));
    }

    private clearHistory(): void {
        this.shared.messages = [];
        console.log('🧹 Conversation history cleared!');
    }

    private async processUserInput(input: string): Promise<boolean> {
        const trimmedInput = input.trim().toLowerCase();

        // Handle special commands
        if (['exit', 'quit', 'bye'].includes(trimmedInput)) {
            console.log('\n👋 Thanks for chatting! Goodbye!');
            return false; // Exit chat
        }

        if (trimmedInput === 'history') {
            this.showHistory();
            return true; // Continue chat
        }

        if (trimmedInput === 'clear') {
            this.clearHistory();
            return true; // Continue chat
        }

        if (trimmedInput === '') {
            console.log('💭 Please enter a message or type "exit" to quit.');
            return true; // Continue chat
        }

        try {
            // Show typing indicator
            process.stdout.write('🤖 AI is thinking');
            const typingInterval = setInterval(() => {
                process.stdout.write('.');
            }, 500);

            // Send message to AI
            const response = await sendMessage(this.shared, input.trim());
            
            // Clear typing indicator
            clearInterval(typingInterval);
            process.stdout.write('\r' + ' '.repeat(20) + '\r'); // Clear the typing line

            // Display the conversation
            const userMessage = this.shared.messages[this.shared.messages.length - 2];
            const aiMessage = this.shared.messages[this.shared.messages.length - 1];

            console.log(this.formatMessage(userMessage.role, userMessage.content));
            console.log(this.formatMessage(aiMessage.role, aiMessage.content));
            console.log(); // Empty line for spacing

        } catch (error) {
            console.error('\n❌ Error communicating with AI:', error instanceof Error ? error.message : 'Unknown error');
            console.log('🔄 Please try again or check your API key.\n');
        }

        return true; // Continue chat
    }

    public async start(): Promise<void> {
        this.showWelcome();

        return new Promise((resolve) => {
            const askQuestion = () => {
                this.rl.question('\n💬 You: ', async (input) => {
                    const shouldContinue = await this.processUserInput(input);
                    
                    if (shouldContinue) {
                        askQuestion(); // Continue the conversation
                    } else {
                        this.rl.close();
                        resolve();
                    }
                });
            };

            askQuestion();
        });
    }
}

// Main function to start the terminal chat
async function main() {
    const chat = new TerminalChat();
    await chat.start();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Chat interrupted. Goodbye!');
    process.exit(0);
});

// Start the chat
main().catch((error) => {
    console.error('❌ Failed to start chat:', error);
    process.exit(1);
});
