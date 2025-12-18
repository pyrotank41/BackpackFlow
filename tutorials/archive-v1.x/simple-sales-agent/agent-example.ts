import { 
    MCPServerManager, 
    MCPServerConfig,
    AgentNode,
    EventStreamer,
    createInstructorClient
} from "../../src/nodes";
import { StreamEventType } from "../../src/events/event-streamer";
import { config } from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

config({ path: path.join(__dirname, '.env') });

// Toggle for streaming vs non-streaming
const ENABLE_STREAMING = process.argv.includes('--stream');
// Toggle for interactive conversation mode
const ENABLE_INTERACTIVE = process.argv.includes('--interactive');

const mcp_server_configs: MCPServerConfig[] = [
    {
        name: "erp_sales",
        command: "sh",
        args: ["-c", "cd /Users/karansinghkochar/Documents/GitHub/product-quote-mcp && uv run python -m src.standalone_erp_server"],
        transport: "stdio"
    }
];

// Helper function to get user input
function getUserInput(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function agentExample() {
    console.log('🎛️  CONFIGURATION:');
    console.log('   • Default: Single hardcoded message');
    console.log('   • Add --stream flag to listen to real-time events');
    console.log('   • Add --interactive flag for conversation mode');
    console.log(`   • Streaming: ${ENABLE_STREAMING ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`   • Interactive: ${ENABLE_INTERACTIVE ? '✅ ENABLED' : '❌ DISABLED'}\n`);
    
    const mcp_server_manager = new MCPServerManager();
    
    await mcp_server_manager.connectToServers(mcp_server_configs);

    // Set up event streaming if enabled
    let eventStreamer: EventStreamer | undefined;
    let streamChunkCount = 0;
    
    if (ENABLE_STREAMING) {
        eventStreamer = EventStreamer.getInstance();
        
        // Subscribe to events for real-time streaming
        eventStreamer.subscribe('sales_agent', (event) => {
            streamChunkCount++;
            
             switch (event.type) {
                 case StreamEventType.PROGRESS:
                     console.log(`[PROGRESS] ${event.nodeId}: ${JSON.stringify(event.content)}`);
                     break;
                 case StreamEventType.CHUNK:
                     // Real-time text streaming
                     process.stdout.write(event.content);
                     break;
                 case StreamEventType.METADATA:
                     console.log(`[METADATA] ${event.nodeId}: ${JSON.stringify(event.content)}`);
                     break;
                 case StreamEventType.FINAL:
                     console.log(`[FINAL] ${JSON.stringify(event.content)}`);
                     break;
                 case StreamEventType.ERROR:
                     console.log(`[ERROR] ${JSON.stringify(event.content)}`);
                     break;
             }
        });
    }

    // Create LLM client (auto-detects OpenAI vs Azure OpenAI)
    console.log('🔍 Creating LLM client...');
    const instructorClient = createInstructorClient({ provider: 'azure' });

    // Create a sales agent with custom prompts and optional event streaming
    const salesAgent = new AgentNode({
        agentName: "SalesAgent",

        // LLM configuration with explicit client
        llmConfig: {
            instructorClient: instructorClient,  // Explicitly pass the client
            model: 'gpt4.1',
            temperature: 0.1
        },

        // Decision loop control - prevent infinite loops
        maxTurns: 5,  // Maximum 5 decision loop turns before forcing final answer

        // Sales-specific system prompts for different nodes
        decisionPrompt:  `You are an expert sales assistant with access to a comprehensive ERP system for product quotes and inventory management.

Your role is to help customers with:
- Product inquiries and specifications
- Pricing and quote generation
- Inventory availability checks
- Order processing guidance
- Technical product support

Decision Guidelines:
- ALWAYS use tools when customers ask about specific products, pricing, or availability
- Use tools for quote generation, inventory checks, and order-related queries
- Only provide direct responses for general sales advice or when no tools are needed
- Be proactive in gathering product information to provide comprehensive quotes

When deciding whether to use tools, consider:
- Does the customer need specific product information?
- Are they asking for pricing or quotes?
- Do they need inventory availability?
- Are they ready to place an order?

Use the tools to verify the information provided by the user, Automatically validate the information provided by the user using the tools.
when validating the information, if the information is not correct, ask the user for the correct information. 

Before calling tools, please make sure we have the correct parameters for the tools, dont assume unless specified here.
while searching for information, sometime you need to use fewr keywords to get the correct info

the name of the company and the name of the contact need to be validated using tool call

If any of these apply, use the appropriate tools to provide accurate, real-time information.`
        ,

        paramGenerationPrompt: `You are a sales assistant specialized in extracting precise parameters from tool descriptions and conversation context.

CRITICAL INSTRUCTIONS:
1. Read the "Tool parameter brief" carefully - it contains all the specific values you need
2. Extract exact values mentioned in the brief (customer names, SKUs, quantities, etc.)
3. For items_data arrays, create proper objects with all required fields
4. Use the format examples provided in the tool description

For create_quotation tool specifically:
- Extract customer_name from the brief (e.g., "PRACHI ELECTRICALS")
- Extract contact_name from the brief (e.g., "Prachi Pradhan")
- For items_data, create array with objects containing:
  * item_code: Extract the SKU from brief (e.g., "BB20100C")
  * qty: Extract quantity from brief (e.g., 20)
  * discount_percentage: Default to 0 unless specified

Example: If brief says "Generate quotation for ACME Corp (contact: John Smith) for 5 units of Widget X (SKU: WX123)"
Result: {
  "customer_name": "ACME Corp",
  "contact_name": "John Smith", 
  "sales_representative_name": "",
  "items_data": [{"item_code": "WX123", "qty": 5, "discount_percentage": 0}]
}

Always extract actual values from the tool parameter brief, never use empty objects or placeholder values.`,

        finalAnswerPrompt: `You are a professional sales representative providing comprehensive responses based on ERP system data.

Your communication style should be:
- Professional yet friendly and approachable
- Knowledgeable about products and pricing
- Helpful in guiding customers toward purchase decisions
- Clear about next steps and processes


Remember: You're representing the company, so maintain professionalism while being genuinely helpful in meeting customer needs.`
        ,
        
        // Event streaming configuration (much cleaner API! 🎉)
        ...(eventStreamer && { 
            eventStreamer: eventStreamer,
            namespace: 'sales_agent'
        })
    });

    // Prepare the shared storage
    let sharedStorage: any = {
        messages: [],
        tool_manager: mcp_server_manager
        // available_tools will be auto-discovered by AgentNode!
    };

    // Get initial message
    if (ENABLE_INTERACTIVE) {
        console.log('💬 Interactive mode: Type your message to the sales agent');
        console.log('   Type "quit" or "exit" to end the conversation\n');
        const userMessage = await getUserInput('You: ');
        if (userMessage.toLowerCase() === 'quit' || userMessage.toLowerCase() === 'exit') {
            console.log('👋 Goodbye!');
            await mcp_server_manager.disconnect();
            return;
        }
        sharedStorage.messages = [{
            role: 'user' as const,
            content: userMessage
        }];
    } else {
        sharedStorage.messages = [{
            role: 'user' as const, 
            content: 'Please generate a formal quote'
        }];
    }

    console.log('🤖 Starting Sales Agent...\n');
    console.log(`Agent Info:`, salesAgent.getNodeInfo());
    console.log(`🎛️  Event Streaming: ${ENABLE_STREAMING ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`🗣️  Interactive Mode: ${ENABLE_INTERACTIVE ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log('\n' + '='.repeat(80));

    const startTime = Date.now();
    let totalExecutions = 0;
    
    try {
        // Auto-discover tools and prep (only once)
        console.log('🔍 Auto-discovering available tools...');
        const initialPrepRes = await salesAgent.prep(sharedStorage) as any;
        console.log(`✅ Discovered ${initialPrepRes.available_tools?.length || 0} tools`);
        console.log('✅ Agent prep completed\n');

        if (ENABLE_INTERACTIVE) {
            console.log('🔄 Starting interactive conversation loop...\n');
            
            // Interactive conversation loop
            while (true) {
                totalExecutions++;
                
                // Single execution path - events are emitted automatically if EventStreamer is configured
                if (ENABLE_STREAMING) {
                    console.log('📡 Agent processing with real-time events...\n');
                    console.log('─'.repeat(80) + '\n');
                } else {
                    console.log('🔄 Agent processing...\n');
                }
                
                const execRes = await salesAgent.exec(initialPrepRes) as any;
                
                if (ENABLE_STREAMING) {
                    console.log('\n' + '─'.repeat(80));
                }
                
                // Post processing
                await salesAgent.post(sharedStorage, initialPrepRes, execRes);
                
                console.log('\n💬 AGENT RESPONSE:');
                console.log('-'.repeat(50));
                console.log((sharedStorage as any).finalAnswer || 'No response generated');
                console.log('-'.repeat(50));
                
                // Get next user input
                const userMessage = await getUserInput('\nYou: ');
                if (userMessage.toLowerCase() === 'quit' || userMessage.toLowerCase() === 'exit') {
                    console.log('👋 Goodbye!');
                    break;
                }
                
                // Add user message to shared storage (the conversation history is maintained automatically)
                sharedStorage.messages.push({
                    role: 'user' as const,
                    content: userMessage
                });
                
                // Reset chunk count for next iteration
                streamChunkCount = 0;
            }
        } else {
            // Single execution (original behavior)
            totalExecutions = 1;
            
            if (ENABLE_STREAMING) {
                console.log('📡 Agent executing with real-time events...\n');
                console.log('─'.repeat(80) + '\n');
            } else {
                console.log('🔄 Agent executing (events ignored)...\n');
            }
            
            const execRes = await salesAgent.exec(initialPrepRes) as any;
            
            if (ENABLE_STREAMING) {
                console.log('\n' + '─'.repeat(80));
                console.log(`📦 Received ${streamChunkCount} events`);
            }
            
            // Post processing
            await salesAgent.post(sharedStorage, initialPrepRes, execRes);
            console.log('✅ Agent execution completed');
            
            console.log('\n💬 FINAL RESPONSE:');
            console.log('-'.repeat(50));
            console.log((sharedStorage as any).finalAnswer || 'No response generated');
        }
        
        const endTime = Date.now();
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 EXECUTION SUMMARY:');
        console.log(`⏱️  Total time: ${endTime - startTime}ms`);
        console.log(`🤖 Agent: ${salesAgent.agentName}`);
        console.log(`🎛️  Mode: ${ENABLE_STREAMING ? 'Event-driven streaming' : 'Non-streaming'}`);
        console.log(`🗣️  Interactive: ${ENABLE_INTERACTIVE ? 'Conversation mode' : 'Single execution'}`);
        console.log(`🔢 Total executions: ${totalExecutions}`);
        console.log(`📝 Final response length: ${(sharedStorage as any).finalAnswer?.length || 0} characters`);
        
        if (ENABLE_STREAMING) {
            console.log(`📦 Final events received: ${streamChunkCount}`);
        }
        
        if (!ENABLE_INTERACTIVE) {
            console.log('\n📋 Internal State:');
            console.log(JSON.stringify(salesAgent.getInternalState(sharedStorage), null, 2));
        }
        
    } catch (error) {
        console.error('❌ Agent execution failed:', error);
    }

    // Cleanup
    if (eventStreamer) {
        eventStreamer.clearAll();
    }
    await mcp_server_manager.disconnect();
}

async function main() {
    try {
        await agentExample();
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

main().catch(console.error);
