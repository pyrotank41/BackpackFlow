import { Node, Flow } from 'pocketflow';
import { callLLM } from './utils';
import * as readline from 'readline';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface SharedState {
  messages: Message[];
}

class ChatNode extends Node<SharedState> {
  private rl: readline.Interface;

  constructor() {
    super();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async prep(shared: SharedState): Promise<Message[] | null> {
    // Initialize messages if this is the first run
    if (!shared.messages) {
      shared.messages = [];
      console.log("Welcome to the chat! Type 'exit' to end the conversation.");
    }
    
    // Get user input
    const userInput = await this.getUserInput();
    
    // Check if user wants to exit
    if (userInput.toLowerCase() === 'exit') {
      this.rl.close();
      return null;
    }
    
    // Add user message to history
    shared.messages.push({ role: 'user', content: userInput });
    
    // Return all messages for the LLM
    return shared.messages;
  }

  async exec(messages: Message[] | null): Promise<string | null> {
    if (messages === null) {
      return null;
    }
    
    // Call LLM with the entire conversation history
    const response = await callLLM(messages);
    return response;
  }

  async post(shared: SharedState, prepRes: Message[] | null, execRes: string | null): Promise<string | undefined> {
    if (prepRes === null || execRes === null) {
      console.log("\nGoodbye!");
      return undefined; // End the conversation
    }
    
    // Print the assistant's response
    console.log(`\nAssistant: ${execRes}`);
    
    // Add assistant message to history
    shared.messages.push({ role: 'assistant', content: execRes });
    
    // Loop back to continue the conversation
    return "continue";
  }

  private getUserInput(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question('\nYou: ', (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Create the flow with self-loop
const chatNode = new ChatNode();
chatNode.on("continue", chatNode); // Loop back to continue conversation

const flow = new Flow(chatNode);

// Start the chat
async function main() {
  try {
    const shared: SharedState = { messages: [] };
    await flow.run(shared);
  } catch (error) {
    console.error('Error running chat:', error);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}
