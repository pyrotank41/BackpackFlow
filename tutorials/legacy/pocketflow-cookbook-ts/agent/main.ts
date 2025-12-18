import { Node, Flow } from 'pocketflow';
import { z } from 'zod';
import { getInstructorClient, searchWeb, SearchResult } from './utils';

// STEP 1: Define structured output schemas for agent communication

// Decision schema - for the agent to decide next action
const DecisionSchema = z.object({
  action: z.enum(["search", "answer"]).describe("Whether to search for more information or provide the final answer"),
  reasoning: z.string().describe("Clear explanation of why this action was chosen"),
  search_query: z.string().optional().describe("Search query to use if action is 'search'"),
  confidence: z.number().min(0).max(1).describe("Confidence level in having enough information (0-1)")
});

// Search results schema - for structuring web search findings
const SearchResultsSchema = z.object({
  query: z.string().describe("The search query that was used"),
  results_count: z.number().describe("Number of search results found"),
  key_findings: z.array(z.string()).describe("Key pieces of information extracted from search results"),
  summary: z.string().describe("Brief summary of what was learned from this search")
});

// Final answer schema - for the comprehensive research response
const FinalAnswerSchema = z.object({
  title: z.string().describe("Engaging title for the research findings"),
  answer: z.string().describe("Comprehensive answer based on all research conducted"),
  key_points: z.array(z.string()).describe("List of the most important points discovered"),
  confidence_level: z.enum(["high", "medium", "low"]).describe("Overall confidence in the completeness of the answer"),
  sources_used: z.number().describe("Number of sources consulted during research")
});

// STEP 2: Define types from schemas
type Decision = z.infer<typeof DecisionSchema>;
type SearchResults = z.infer<typeof SearchResultsSchema>;
type FinalAnswer = z.infer<typeof FinalAnswerSchema>;

// STEP 3: Define shared state for the research agent
interface ResearchState {
  question: string;
  searchHistory: SearchResults[];
  allFindings: string[];
  searchCount: number;
  maxSearches: number;
  finalAnswer?: FinalAnswer;
}

// STEP 4: Create the decision-making node
class DecisionNode extends Node<ResearchState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: ResearchState): Promise<{ question: string; context: string; searchCount: number }> {
    console.log('\n🧠 Analyzing question and deciding next action...');
    
    // Build context from previous research
    const context = shared.allFindings.length > 0 
      ? `Previous research findings:\n${shared.allFindings.join('\n\n')}`
      : 'No previous research conducted yet.';
    
    return {
      question: shared.question,
      context: context,
      searchCount: shared.searchCount
    };
  }

  async exec(input: { question: string; context: string; searchCount: number }): Promise<Decision> {
    const decision = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a research agent that decides whether to search for more information or provide a final answer.
                   
                   Decision Guidelines:
                   - Choose "search" if you need more information to answer comprehensively
                   - Choose "answer" if you have sufficient information or have reached the search limit
                   - Be specific about search queries to get the most relevant information
                   - Consider the complexity of the question when deciding`
        },
        {
          role: "user",
          content: `Question to research: "${input.question}"
                   
                   Current context:
                   ${input.context}
                   
                   Searches performed so far: ${input.searchCount}
                   
                   Should I search for more information or provide the final answer?`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: DecisionSchema,
        name: "ResearchDecision"
      },
      temperature: 0.3
    });

    console.log(`📋 Decision: ${decision.action.toUpperCase()}`);
    console.log(`💭 Reasoning: ${decision.reasoning}`);
    
    return decision;
  }

  async post(shared: ResearchState, prepRes: any, execRes: Decision): Promise<string> {
    if (execRes.action === "search" && shared.searchCount < shared.maxSearches) {
      return "search";
    } else {
      return "answer";
    }
  }
}

// STEP 5: Create the web search node
class SearchNode extends Node<ResearchState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: ResearchState): Promise<string> {
    // Get the search query from the last decision (stored in shared state temporarily)
    const lastDecision = (shared as any).lastDecision as Decision;
    const searchQuery = lastDecision?.search_query || shared.question;
    
    console.log(`\n🔍 Performing web search...`);
    return searchQuery;
  }

  async exec(searchQuery: string): Promise<SearchResults> {
    // Perform the actual web search
    const webResults = await searchWeb(searchQuery, 5);
    
    // Use LLM to analyze and structure the search results
    const combinedResults = webResults.map(result => 
      `Title: ${result.title}\nContent: ${result.snippet}`
    ).join('\n\n');

    const analysis = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a research assistant that analyzes web search results and extracts key information."
        },
        {
          role: "user",
          content: `Analyze these search results for the query "${searchQuery}" and extract the key findings:
                   
                   ${combinedResults}
                   
                   Extract the most important and relevant information that helps answer research questions.`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: SearchResultsSchema,
        name: "SearchAnalysis"
      },
      temperature: 0.2
    });

    return analysis;
  }

  async post(shared: ResearchState, prepRes: string, execRes: SearchResults): Promise<string> {
    // Store the search results
    shared.searchHistory.push(execRes);
    shared.allFindings.push(...execRes.key_findings);
    shared.allFindings.push(execRes.summary);
    shared.searchCount++;

    console.log(`📚 Added ${execRes.key_findings.length} key findings from search`);
    console.log(`🔢 Total searches performed: ${shared.searchCount}`);

    return "decide"; // Go back to decision node
  }
}

// STEP 6: Create the answer generation node  
class AnswerNode extends Node<ResearchState> {
  private client: any;

  constructor() {
    super();
    this.client = getInstructorClient();
  }

  async prep(shared: ResearchState): Promise<{ question: string; research: string }> {
    console.log('\n📝 Generating comprehensive answer based on research...');
    
    const researchSummary = `
Research conducted: ${shared.searchCount} searches

Key findings from research:
${shared.allFindings.join('\n• ')}

Search history:
${shared.searchHistory.map((search, index) => 
  `Search ${index + 1}: ${search.query}\nSummary: ${search.summary}`
).join('\n\n')}`;

    return {
      question: shared.question,
      research: researchSummary
    };
  }

  async exec(input: { question: string; research: string }): Promise<FinalAnswer> {
    const finalAnswer = await this.client.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert research writer who creates comprehensive, well-structured answers based on research findings.
                   
                   Guidelines:
                   - Write a detailed, informative answer
                   - Structure the response clearly with logical flow
                   - Include specific details from the research
                   - Be objective and factual
                   - Make the answer engaging and accessible`
        },
        {
          role: "user",
          content: `Question: ${input.question}
                   
                   Research findings:
                   ${input.research}
                   
                   Please provide a comprehensive answer based on all the research conducted.`
        }
      ],
      model: "gpt-4o",
      response_model: {
        schema: FinalAnswerSchema,
        name: "ResearchAnswer"
      },
      temperature: 0.7
    });

    return finalAnswer;
  }

  async post(shared: ResearchState, prepRes: any, execRes: FinalAnswer): Promise<string | undefined> {
    shared.finalAnswer = execRes;

    // Display the final answer
    console.log('\n📄 Final Answer:');
    console.log('='.repeat(50));
    console.log(`# ${execRes.title}\n`);
    console.log(execRes.answer);
    
    if (execRes.key_points.length > 0) {
      console.log('\n## Key Points:');
      execRes.key_points.forEach((point, index) => {
        console.log(`${index + 1}. ${point}`);
      });
    }
    
    console.log('='.repeat(50));
    
    // Display research statistics
    console.log('\n📊 Research Statistics:');
    console.log(`- Searches performed: ${shared.searchCount}`);
    console.log(`- Sources consulted: ${execRes.sources_used}`);
    console.log(`- Confidence level: ${execRes.confidence_level}`);
    console.log(`- Research depth: ${shared.allFindings.length > 10 ? 'Comprehensive' : 'Standard'}`);
    
    console.log('\n✅ Research Complete!');
    return undefined; // End the workflow
  }
}

// STEP 7: Create and run the research agent
export async function runResearchAgent(question: string = "Who won the Nobel Prize in Physics in 2023?"): Promise<ResearchState> {
  console.log('🤖 Research Agent - PocketFlow + Instructor');
  console.log('==========================================');
  console.log(`Question: ${question}\n`);

  // Initialize research state
  const shared: ResearchState = {
    question: question,
    searchHistory: [],
    allFindings: [],
    searchCount: 0,
    maxSearches: 3 // Limit searches to prevent infinite loops
  };

  // Create nodes
  const decisionNode = new DecisionNode();
  const searchNode = new SearchNode();
  const answerNode = new AnswerNode();

  // Set up node connections - this is where the magic happens!
  decisionNode.on("search", searchNode);
  decisionNode.on("answer", answerNode);
  searchNode.on("decide", decisionNode);

  // Custom decision handling to pass search query
  const originalDecisionExec = decisionNode.exec.bind(decisionNode);
  decisionNode.exec = async function(input: any) {
    const decision = await originalDecisionExec(input);
    (shared as any).lastDecision = decision; // Store for SearchNode
    return decision;
  };

  // Create and run the flow
  const flow = new Flow(decisionNode);
  await flow.run(shared);

  return shared;
}

// STEP 8: Main execution function
async function main() {
  try {
    // Get question from command line arguments or use default
    const question = process.argv[2] || "Who won the Nobel Prize in Physics in 2023?";
    
    const result = await runResearchAgent(question);
    
    // Optionally save the research report
    if (process.env.SAVE_RESEARCH === 'true') {
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `research-${timestamp}.json`;
      
      const report = {
        question: result.question,
        searchHistory: result.searchHistory,
        finalAnswer: result.finalAnswer,
        statistics: {
          searchCount: result.searchCount,
          findingsCount: result.allFindings.length
        },
        timestamp: new Date().toISOString()
      };
      
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`\n💾 Research report saved to: ${filename}`);
    }
    
  } catch (error) {
    console.error('❌ Error running research agent:', error);
    process.exit(1);
  }
}

// Helper function for external use
export async function quickResearch(question: string): Promise<string> {
  const result = await runResearchAgent(question);
  return result.finalAnswer?.answer || 'Research failed to produce an answer.';
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
