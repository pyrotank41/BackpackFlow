import { SharedStorage, sendMessage } from './chatbot-core';


// step 4: define the main function that will run the flow. 
async function main() {
    const shared: SharedStorage = { messages: [] };
    await sendMessage(shared, "Hello, how are you?");
    
    // Print the conversation
    console.log('Conversation:');
    shared.messages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
    });
}


// run the flow by `npx ts-node simple-chatbot.ts`
main();

