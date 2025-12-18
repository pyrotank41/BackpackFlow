import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import { Node, Flow } from '../../../src/pocketflow';
import OpenAI from 'openai';

/**
 * Basic Chat Node Template - PocketFlow Pattern
 * 
 * This template demonstrates the prep→exec→post pattern for any chat completion task.
 * Customize the storage type, LLM provider, and processing logic for your specific use case.
 * 
 * Usage:
 * 1. Copy this template
 * 2. Customize the storage type for your needs
 * 3. Update the LLM call in exec() for your provider
 * 4. Modify prep() and post() for your data processing
 */

// TODO: Customize this type for your application's needs
type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: Date;
}

// TODO: Extend this storage type with your application's data
type SharedStorage = {
    messages: Message[];
    userMessage: string;
    // Add your custom fields here:
    // context?: string;
    // metadata?: any;
    // config?: any;
}

// TODO: Customize this LLM call for your provider (OpenAI, Anthropic, local model, etc.)
async function callLLM(messages: Message[]): Promise<string> {
    // 🔐 Check for API key
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
            model: 'gpt-4o', // TODO: Configure your preferred model
            messages: messages,
            // TODO: Add your custom parameters:
            // temperature: 0.7,
            // max_tokens: 1000,
            // top_p: 1,
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('LLM returned empty response');
        }
        
        return content;
    } catch (error) {
        // 🔄 Handle common errors
        if (error instanceof Error) {
            if (error.message.includes('401')) {
                throw new Error('Invalid API key - please check your .env file');
            }
            if (error.message.includes('quota')) {
                throw new Error('LLM quota exceeded - check your billing');
            }
        }
        throw error;
    }
}

// 🤖 PocketFlow Chat Node - Follows prep→exec→post pattern
class ChatNode extends Node<SharedStorage> {
    private debug = process.env.DEBUG_CHAT === 'true';

    constructor() {
        super();
    }

    // 🎯 PREP: Extract & Transform data from SharedStorage
    // TODO: Customize this method for your data preparation needs
    async prep(shared: SharedStorage): Promise<Message[]> {
        if (this.debug) console.log('🔍 PREP: Processing user input');
        
        // TODO: Add your custom preparation logic here
        // Examples:
        // - Add system messages
        // - Apply conversation limits
        // - Add context from other sources
        // - Validate input
        
        // Add user message to conversation
        shared.messages.push({ 
            role: 'user', 
            content: shared.userMessage,
            timestamp: new Date() // Optional: add timestamps
        });
        
        if (this.debug) console.log(`🔍 PREP: Conversation has ${shared.messages.length} messages`);
        
        // Return data for exec() - this is what the LLM will see
        return shared.messages;
    }
    
    // ⚡ EXEC: Pure business logic (isolated from SharedStorage)
    // TODO: Customize this method for your LLM provider and processing
    async exec(messages: Message[]): Promise<string> {
        if (this.debug) console.log('🔍 EXEC: Calling LLM');
        
        try {
            // TODO: Replace with your LLM provider call
            const response = await callLLM(messages);
            
            if (this.debug) console.log('🔍 EXEC: Received LLM response');
            return response;
        } catch (error) {
            console.error('❌ EXEC: LLM call failed:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }
    
    // 💾 POST: Handle results and update SharedStorage
    // TODO: Customize this method for your result processing needs
    async post(shared: SharedStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        if (this.debug) console.log('🔍 POST: Storing results');
        
        // TODO: Add your custom post-processing logic here
        // Examples:
        // - Save to database
        // - Update analytics
        // - Trigger notifications
        // - Process the response further
        
        // Store AI response in conversation history
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string,
            timestamp: new Date() // Optional: add timestamps
        });
        
        if (this.debug) console.log(`🔍 POST: Conversation now has ${shared.messages.length} messages`);
        
        // TODO: Return next node name for multi-node flows, or undefined to end
        return undefined; // Ends the flow
    }
}

// 🚀 Example Usage
async function main() {
    console.log('🎓 Chat Node Template Example\n');

    try {
        // 1. Create your ChatNode
        const chatNode = new ChatNode();
        
        // 2. Create a Flow to orchestrate the node
        const chatFlow = new Flow(chatNode);
        
        // 3. Set up SharedStorage with your data
        const shared: SharedStorage = { 
            messages: [], // Start with empty conversation
            userMessage: "Hello! Explain the prep→exec→post pattern briefly."
            // TODO: Add your custom data here
        };
        
        console.log('🏃 Running the flow...');
        console.log(`📝 User message: "${shared.userMessage}"`);
        console.log();

        // 4. Run the flow - calls prep→exec→post automatically
        await chatFlow.run(shared);
        
        // 5. Display results
        console.log('💬 Conversation Result:');
        console.log('━'.repeat(50));
        shared.messages.forEach((msg, index) => {
            const icon = msg.role === 'user' ? '👤' : 
                        msg.role === 'system' ? '⚙️' : '🤖';
            const timestamp = msg.timestamp ? ` (${msg.timestamp.toLocaleTimeString()})` : '';
            console.log(`${index + 1}. ${icon} ${msg.role}${timestamp}: ${msg.content}`);
            console.log();
        });
        
        console.log('✅ Template example complete!');
        console.log('\n💡 Customization Ideas:');
        console.log('   • Add system messages for personality');
        console.log('   • Implement conversation length limits');
        console.log('   • Add cost tracking and token counting');
        console.log('   • Support multiple LLM providers');
        console.log('   • Add streaming responses');
        console.log('   • Implement error recovery and retries');
        
    } catch (error) {
        console.error('\n❌ Something went wrong:');
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

// TODO: Remove this line when using as a template
main().catch(console.error);

export { ChatNode, SharedStorage, Message };
