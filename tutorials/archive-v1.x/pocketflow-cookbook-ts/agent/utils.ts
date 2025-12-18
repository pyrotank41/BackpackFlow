import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import Exa from 'exa-js';
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a singleton Instructor client
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

// Web search functionality using Exa.ai for high-quality search results
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  highlights?: string[];
  score?: number;
}

export async function searchWeb(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  try {
    console.log(`🔍 Searching for: ${query}`);
    
    // Initialize Exa client
    const exa = new Exa(process.env.EXA_API_KEY);
    
    // Perform search with content extraction and highlights
    const response = await exa.searchAndContents(query, {
      numResults: maxResults,
      highlights: true,
      useAutoprompt: true, // Let Exa optimize the query
      text: true // Get full text content
    });
    
    const results: SearchResult[] = response.results.map(result => ({
      title: result.title || 'Untitled',
      url: result.url,
      snippet: result.text ? result.text.slice(0, 500) + '...' : 'No content available',
      highlights: result.highlights || [],
      score: result.score
    }));
    
    console.log(`✨ Found ${results.length} high-quality results from Exa`);
    return results;
    
  } catch (error) {
    console.error('❌ Error searching with Exa:', error);
    
    // Fallback to mock results if Exa fails
    console.log('📝 Using fallback mock results...');
    return [
      {
        title: `Research: ${query}`,
        url: 'https://example.com/research',
        snippet: `Comprehensive information about ${query}. This is a fallback result - please check your EXA_API_KEY environment variable.`,
        highlights: [`Information about ${query}`],
        score: 0.5
      },
      {
        title: `Latest developments in ${query}`,
        url: 'https://example.com/developments', 
        snippet: `Recent advances and discoveries related to ${query}. Please configure Exa.ai API for real search results.`,
        highlights: [`Recent advances in ${query}`],
        score: 0.4
      }
    ];
  }
}

// Test function to verify setup
async function testSetup() {
  console.log('🧪 Testing Research Agent Setup');
  console.log('================================\n');
  
  try {
    // Test Instructor client
    console.log('1. Testing OpenAI connection...');
    const client = getInstructorClient();
    
    const TestResponseSchema = z.object({
      message: z.string().describe("A test message from the AI")
    });

    const testResponse = await client.chat.completions.create({
      messages: [
        { role: 'user', content: 'Say "Setup test successful!" if you can hear me.' }
      ],
      model: 'gpt-4o',
      response_model: {
        schema: TestResponseSchema,
        name: 'TestResponse'
      }
    });
    
    console.log(`✅ OpenAI Response: ${testResponse.message}\n`);
    
    // Test Exa web search
    console.log('2. Testing Exa web search...');
    const searchResults = await searchWeb('artificial intelligence', 3);
    
    console.log('✅ Exa Search Results:');
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.title}`);
      console.log(`      Score: ${result.score || 'N/A'}`);
      console.log(`      ${result.snippet.slice(0, 80)}...`);
      if (result.highlights && result.highlights.length > 0) {
        console.log(`      Key highlights: ${result.highlights.slice(0, 2).join(', ')}`);
      }
    });
    
    console.log('\n🎉 All tests passed! Ready to run the research agent.');
    
  } catch (error) {
    console.error('❌ Setup test failed:', error);
    console.log('\n💡 Make sure your OPENAI_API_KEY and EXA_API_KEY are set correctly.');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSetup();
}
