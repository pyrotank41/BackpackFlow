import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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

// Test function (equivalent to if __name__ == "__main__")
async function main() {
  try {
    // Test the LLM call
    const messages: Message[] = [{ role: 'user', content: "In a few words, what's the meaning of life?" }];
    const response = await callLLM(messages);
    console.log(`Prompt: ${messages[0].content}`);
    console.log(`Response: ${response}`);
  } catch (error) {
    console.error('Error calling LLM:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  main();
}
