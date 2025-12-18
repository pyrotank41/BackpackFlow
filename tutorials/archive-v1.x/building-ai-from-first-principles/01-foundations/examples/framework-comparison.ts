import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });

import { OpenAIProvider } from 'backpackflow/providers';
import { ChatNode, ChatNodeStorage } from 'backpackflow/nodes';
import { Flow } from 'backpackflow/pocketflow';



// BackpackFlow approach - using framework components
async function main() {
    console.log('🎓 BackpackFlow Framework Example\n');

    // 1. Use BackpackFlow's provider abstraction
    const llmProvider = new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY ?? ''
    });

    // 2. Create a ChatNode with system message
    const chatNode = new ChatNode({
        llmProvider,
        systemMessage: 'You are a helpful assistant that explains framework concepts clearly.', // this message is added to conversation history if its not already there in the storage
        temperature: 0.7,
        model: 'gpt-5'
    });

    // 3. we know that ChatNode uses ChatNodeStorage type of shared storage, lets add a user message to the storage
    // this might look redundent way of passing the storage, but this will become clear in the next part when we have multiple nodes as to why we need to do this, for now just trust me. 
    const storage: ChatNodeStorage = {
        "chat": {
            "messages": [
                {
                    role: 'user',
                    content: 'Explain the benefits of using a framework vs raw implementation',
                    timestamp: new Date()
                }
            ]
        }
    };

    // 3. Create a flow that uses the ChatNode
    const chatFlow = new Flow(chatNode);

    // 4. Run the flow - it will process the user message already in storage
    await chatFlow.run(storage);
    
    // 5. Display the conversation
    console.log('💬 Conversation:');
    const conversation = chatNode.getConversation(storage);
    conversation.forEach((msg, i) => {
        const icon = msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖';
        console.log(`${i + 1}. ${icon} ${msg.role}: ${msg.content}`);
    });
    
    console.log('\n✅ Framework example complete!');
    console.log('\n🔧 Chat Configuration:');
    console.log(`   • Model: ${storage.chat?.config?.model ?? 'unknown'}`);
    console.log(`   • Temperature: ${storage.chat?.config?.temperature ?? 'unknown'}`);
    console.log(`   • Max Tokens: ${storage.chat?.config?.maxTokens ?? 'unknown'}`);
}

main().catch(console.error);
