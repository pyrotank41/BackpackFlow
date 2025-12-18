import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a singleton Instructor client to avoid recreating it in every node
let instructorClient: any = null;

export function getInstructorClient() {
  if (!instructorClient) {
    const oai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key'
    });
    
    instructorClient = Instructor({
      client: oai,
      mode: "FUNCTIONS"
    });
  }
  
  return instructorClient;
}
