import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import * as readline from 'readline';
import { Node, Flow } from '../../../src/pocketflow';
import OpenAI from 'openai';

/**
 * Interactive Terminal Chat Template - PocketFlow Pattern
 * 
 * This template demonstrates how to build an interactive chat application
 * using the prep→exec→post pattern with persistent conversation state.
 * 
 * Features included:
 * - Interactive terminal interface
 * - Persistent conversation history
 * - Built-in commands (history, clear, exit)
 * - Error handling and recovery
 * - Customizable prompts and behavior
 * 
 * Usage:
 * 1. Copy this template
 * 2. Customize the storage type and chat behavior
 * 3. Add your custom commands and features
 * 4. Update the LLM provider as needed
 */

// TODO: Customize message structure for your needs
type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}

// TODO: Extend storage with your application-specific data
type ChatStorage = {
    messages: Message[];
    userMessage: string;
    // Add custom fields:
    // userId?: string;
    // sessionId?: string;
    // context?: any;
    // preferences?: any;
}

// TODO: Customize LLM provider and configuration
async function callLLM(messages: Message[]): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
    }

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const completion = await client.chat.completions.create({
            model: 'gpt-4o', // TODO: Configure your model
            messages: messages,
            // TODO: Add custom parameters:
            // temperature: 0.7,
            // max_tokens: 1000,
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from LLM');
        }
        
        return content;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('Invalid API key');
            }
            if (error.message.includes('quota')) {
                throw new Error('API quota exceeded');
            }
        }
        throw error;
    }
}

// 🤖 Chat Node using PocketFlow pattern
class ChatNode extends Node<ChatStorage> {
    private debug = process.env.DEBUG_CHAT === 'true';

    constructor(private systemMessage?: string) {
        super();
    }

    // 🎯 PREP: Prepare conversation data
    async prep(shared: ChatStorage): Promise<Message[]> {
        if (this.debug) console.log('🔍 PREP: Processing user input');
        
        // TODO: Add system message if configured and not already present
        if (this.systemMessage && shared.messages.length === 0) {
            shared.messages.push({
                role: 'system',
                content: this.systemMessage,
                timestamp: new Date()
            });
        }
        
        // Add user message to conversation
        shared.messages.push({ 
            role: 'user', 
            content: shared.userMessage,
            timestamp: new Date()
        });
        
        // TODO: Add conversation management logic
        // Example: Limit conversation length
        // if (shared.messages.length > 20) {
        //     shared.messages = [
        //         shared.messages[0], // Keep system message
        //         ...shared.messages.slice(-19) // Keep last 19 messages
        //     ];
        // }
        
        if (this.debug) console.log(`🔍 PREP: Conversation has ${shared.messages.length} messages`);
        
        return shared.messages;
    }
    
    // ⚡ EXEC: Call LLM (isolated business logic)
    async exec(messages: Message[]): Promise<string> {
        if (this.debug) console.log('🔍 EXEC: Calling LLM');
        
        try {
            const response = await callLLM(messages);
            if (this.debug) console.log('🔍 EXEC: Received response');
            return response;
        } catch (error) {
            // TODO: Add custom error handling
            console.error('❌ LLM call failed:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
    
    // 💾 POST: Store results and manage state
    async post(shared: ChatStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        if (this.debug) console.log('🔍 POST: Storing response');
        
        // Store AI response
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string,
            timestamp: new Date()
        });
        
        // TODO: Add custom post-processing
        // Examples:
        // - Save to database
        // - Update analytics
        // - Check for special responses
        
        if (this.debug) console.log(`🔍 POST: Conversation now has ${shared.messages.length} messages`);
        
        return undefined; // End flow
    }
}

// 🖥️ Terminal Chat Interface
class TerminalChat {
    private rl: readline.Interface;
    private shared: ChatStorage = { messages: [], userMessage: '' };
    private chatNode: ChatNode;
    private chatFlow: Flow<ChatStorage>;

    constructor(systemMessage?: string) {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        
        this.chatNode = new ChatNode(systemMessage);
        this.chatFlow = new Flow(this.chatNode);
    }

    // 🚀 Start the interactive chat session
    async start() {
        this.displayWelcome();
        await this.chatLoop();
    }

    // 💬 Main chat interaction loop
    private async chatLoop() {
        while (true) {
            try {
                const input = await this.getUserInput();
                
                // Handle built-in commands
                if (await this.handleCommand(input)) {
                    continue;
                }
                
                // Process user message with AI
                await this.processUserMessage(input);
                
            } catch (error) {
                console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
                console.log('💡 Try again or type "exit" to quit\n');
            }
        }
    }

    // 📝 Get user input
    private getUserInput(): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question('💬 You: ', (answer) => {
                resolve(answer.trim());
            });
        });
    }

    // ⚡ Process user message through ChatNode
    private async processUserMessage(input: string) {
        this.shared.userMessage = input;
        
        console.log('🤖 AI is thinking...');
        
        await this.chatFlow.run(this.shared);
        
        // Display AI response
        const lastMessage = this.shared.messages[this.shared.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
            console.log(`🤖 AI: ${lastMessage.content}\n`);
        }
    }

    // 🎛️ Handle built-in commands
    private async handleCommand(input: string): Promise<boolean> {
        const command = input.toLowerCase();
        
        switch (command) {
            case 'exit':
            case 'quit':
            case 'bye':
                console.log('👋 Thanks for chatting! Goodbye!');
                this.rl.close();
                process.exit(0);
                
            case 'history':
                this.displayHistory();
                return true;
                
            case 'clear':
                this.clearHistory();
                console.log('🧹 Conversation history cleared!\n');
                return true;
                
            case 'help':
                this.displayHelp();
                return true;
                
            // TODO: Add your custom commands here
            // case 'save':
            //     await this.saveConversation();
            //     return true;
            
            default:
                return false; // Not a command, process as regular message
        }
    }

    // 📜 Display conversation history
    private displayHistory() {
        console.log('📜 Conversation History:');
        console.log('-'.repeat(30));
        
        if (this.shared.messages.length === 0) {
            console.log('No messages yet.\n');
            return;
        }
        
        this.shared.messages.forEach((msg, index) => {
            if (msg.role === 'system') return; // Skip system messages in history
            
            const icon = msg.role === 'user' ? '👤' : '🤖';
            const timestamp = msg.timestamp ? 
                ` (${msg.timestamp.toLocaleTimeString()})` : '';
            console.log(`${index}. ${icon} ${msg.role}${timestamp}: ${msg.content}`);
        });
        console.log('-'.repeat(30) + '\n');
    }

    // 🧹 Clear conversation history
    private clearHistory() {
        // TODO: Customize what gets cleared
        // Keep system message if present
        const systemMessage = this.shared.messages.find(m => m.role === 'system');
        this.shared.messages = systemMessage ? [systemMessage] : [];
    }

    // ❓ Display help information
    private displayHelp() {
        console.log('❓ Available Commands:');
        console.log('  📜 "history" - Show conversation history');
        console.log('  🧹 "clear" - Clear conversation history');
        console.log('  ❓ "help" - Show this help message');
        console.log('  🚪 "exit", "quit", "bye" - End the chat');
        // TODO: Document your custom commands
        console.log('');
    }

    // 🎪 Display welcome message
    private displayWelcome() {
        console.log('🚀 Welcome to Interactive Chat Template!');
        console.log('💬 Type your messages and press Enter to chat with AI');
        console.log('🔚 Type "exit", "quit", or "bye" to end the conversation');
        console.log('📜 Type "history" to see the full conversation');
        console.log('🧹 Type "clear" to clear the conversation history');
        console.log('❓ Type "help" to see available commands');
        console.log('-'.repeat(50) + '\n');
    }

    // TODO: Add custom methods for your application
    // private async saveConversation() { ... }
    // private async loadConversation(id: string) { ... }
    // private generateSessionId() { ... }
}

// 🚀 Main function - customize your chat application here
async function main() {
    try {
        // TODO: Customize the system message for your use case
        const systemMessage = "You are a helpful assistant that provides clear, concise answers.";
        
        const chat = new TerminalChat(systemMessage);
        await chat.start();
        
    } catch (error) {
        console.error('\n❌ Failed to start chat:');
        console.error(error instanceof Error ? error.message : 'Unknown error');
        console.log('\n🔧 Common fixes:');
        console.log('   • Check your .env file has OPENAI_API_KEY');
        console.log('   • Verify your API key is valid');
        console.log('   • Check your internet connection');
        process.exit(1);
    }
}

// TODO: Remove this line when using as a template
main().catch(console.error);

export { TerminalChat, ChatNode, ChatStorage, Message };
