import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import { Node, Flow } from '../../../../src/pocketflow';
import OpenAI from 'openai';

/**
 * Chat Completion - Learning PocketFlow Fundamentals
 * 
 * This example shows how to wrap a basic OpenAI API call in PocketFlow's
 * Node pattern. You'll learn the three-phase lifecycle:
 * • prep() - prepare your data
 * • exec() - do the main work  
 * • post() - handle the results
 * 
 * Run: npx ts-node chat-completion.ts
 */

// Define the structure of our messages and conversation storage
type Message = {
    role: 'user' | 'assistant';
    content: string;
}

type SharedStorage = {
    messages: Message[];
    userMessage: string;
}

// Helper function to call OpenAI API
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

// 🤖 PocketFlow Node that handles the chat completion
// This demonstrates the core prep→exec→post pattern
class ChatNode extends Node<SharedStorage> {
    private debug = process.env.DEBUG_CHAT === 'true';

    constructor() {
        super();
    }

    // 🎯 PREP: Transform SharedStorage into what exec() needs
    // This is the "Extract & Transform" phase of our ETL pattern
    async prep(shared: SharedStorage): Promise<Message[]> {
        if (this.debug) console.log('🔍 PREP: Adding user message to conversation');
        
        // Add the user's message to our conversation history
        shared.messages.push({ role: 'user', content: shared.userMessage });
        
        if (this.debug) console.log(`🔍 PREP: Conversation now has ${shared.messages.length} messages`);
        
        // Return the full conversation - this becomes exec()'s input
        return shared.messages;
    }
    
    // ⚡ EXEC: Do the main work (isolated from SharedStorage)
    // This is the "Process" phase - pure function that's easy to test
    async exec(messages: Message[]): Promise<string> {
        if (this.debug) console.log('🔍 EXEC: Calling LLM with messages:', messages.length);
        
        try {
            const response = await callLLM(messages);
            if (this.debug) console.log('🔍 EXEC: Got response from LLM');
            return response;
        } catch (error) {
            console.error('❌ EXEC: LLM call failed:', error instanceof Error ? error.message : 'Unknown error');
            throw error; // Re-throw to let the flow handle it
        }
    }
    
    // 💾 POST: Handle the results and update SharedStorage
    // This is the "Load" phase - save results and clean up
    async post(shared: SharedStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        if (this.debug) console.log('🔍 POST: Storing AI response in SharedStorage');
        
        // Add AI response to shared storage for future conversations
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string 
        });
        
        if (this.debug) console.log(`🔍 POST: Conversation now has ${shared.messages.length} messages`);
        
        // Return undefined to end the flow (no next node)
        return undefined;
    }
}



// 🚀 Example usage - Let's see the pattern in action!
async function main() {
    console.log('🎓 Chat Completion - PocketFlow Basics\n');

    try {
        // 1️⃣ Create our ChatNode (the "worker" that knows how to chat)
        const chatNode = new ChatNode();
        
        // 2️⃣ Create a Flow that will orchestrate our ChatNode
        // Think of Flow as the "conductor" that runs prep→exec→post
        const chatFlow = new Flow(chatNode);
        
        // 3️⃣ Set up our SharedStorage with a message to process
        // This is the "memory" that travels through our entire flow
        const shared: SharedStorage = { 
            messages: [], // Start with empty conversation
            userMessage: "Explain the ETL process in a few sentences. Reply in markdown format."
        };
        
        console.log('🏃 Running the flow...');
        console.log(`📝 User message: "${shared.userMessage}"`);
        console.log(); // Empty line for spacing

        // 4️⃣ Run the flow! This will call prep→exec→post automatically
        await chatFlow.run(shared);
        
        // 5️⃣ Display the results
        console.log('💬 Conversation Result:');
        console.log('━'.repeat(50));
        shared.messages.forEach((msg, index) => {
            const icon = msg.role === 'user' ? '👤' : '🤖';
            console.log(`${index + 1}. ${icon} ${msg.role}: ${msg.content}`);
            console.log(); // Empty line between messages
        });
        
        console.log('✅ Tutorial complete!');
        console.log('\n💡 What just happened (the PocketFlow pattern):');
        console.log('   🎯 prep() - Added user message to SharedStorage');
        console.log('   ⚡ exec() - Called OpenAI with the conversation');  
        console.log('   💾 post() - Stored AI response back in SharedStorage');
        console.log('\n🧠 Manifesto in Action: "Complex AI systems are just simple ideas stacked together"');
        console.log('   ✨ You just turned 1 complex function into 3 simple, reusable pieces!');
        console.log('\n🚀 Ready for interactive chat? Try: npx tsx interactive-chat.ts');
        console.log('🔧 Want to see debug info? Try: DEBUG_CHAT=true npx tsx basic-chat.ts');
        console.log('🎓 Community & help: see ../JOIN_COMMUNITY.md');
        
    } catch (error) {
        console.error('\n❌ Something went wrong:');
        console.error(error instanceof Error ? error.message : 'Unknown error');
        console.log('\n🔧 Common fixes:');
        console.log('   • Check your .env file has OPENAI_API_KEY');
        console.log('   • Verify your API key is valid');
        console.log('   • Check your internet connection');
        process.exit(1);
    }
}

main().catch(console.error);
