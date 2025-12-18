import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') }); // Load environment variables from .env file in this directory

import { Node, Flow } from '../../src/pocketflow';
import OpenAI from 'openai';

// Types
export type Message = {
    role: 'user' | 'assistant';
    content: string;
}

export type SharedStorage = {
    messages: Message[];
}

// Helper function to call LLM
export async function callLLM(messages: Message[]): Promise<string> {
    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
    });

    const completion = await client.chat.completions.create({
        model: 'gpt-5',
        messages: messages,
    });
    return completion.choices[0].message.content ?? '';
}

// Chatbot Node
export class ChatNode extends Node<SharedStorage> {
    constructor(private userMessage: string) {
        super();
    }

    async prep(shared: SharedStorage): Promise<Message[]> {
        // Add user message to conversation
        shared.messages.push({ role: 'user', content: this.userMessage });
        return shared.messages;
    }
    
    async exec(messages: Message[]): Promise<string> {
        const response = await callLLM(messages);
        return response;
    }
    
    async post(shared: SharedStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        // Add AI response to shared storage
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string 
        });
        return undefined; // End the flow
    }
}

// Chatbot Flow
export class ChatFlow extends Flow<SharedStorage> {
    constructor(userMessage: string) {
        const chatNode = new ChatNode(userMessage);
        super(chatNode);
    }
}

// Utility function to send a message and get response
export async function sendMessage(shared: SharedStorage, message: string): Promise<string> {
    const flow = new ChatFlow(message);
    await flow.run(shared);
    
    // Return the last assistant message
    const lastMessage = shared.messages[shared.messages.length - 1];
    return lastMessage.role === 'assistant' ? lastMessage.content : '';
}
