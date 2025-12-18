import { EventStreamer, DecisionNode, MCPServerManager, MCPServerConfig, createInstructorClient } from "../../src/nodes";

import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(__dirname, '.env') });

async function main() {
    console.log('🎯 Event-Driven Streaming Example\n');
    
    // 1. Create EventStreamer instance
    const eventStreamer = EventStreamer.getInstance();
    
    // 2. Set up MCP server
    const mcp_server_configs: MCPServerConfig[] = [{
        name: "erp_sales",
        command: "sh",
        args: ["-c", "cd /Users/karansinghkochar/Documents/GitHub/product-quote-mcp && uv run python -m src.standalone_erp_server"],
        transport: "stdio"
    }];
    
    const mcp_server_manager = new MCPServerManager();
    await mcp_server_manager.connectToServers(mcp_server_configs);
    const available_tools = await mcp_server_manager.discoverTools();
    
    // 3. Create DecisionNode with EventStreamer
    const instructorClient = createInstructorClient({ provider: 'openai' });
    
    const decisionNode = new DecisionNode({
        instructorClient: instructorClient,
        eventStreamer: eventStreamer,
        namespace: 'sales_demo',
        systemPrompt: 'You are a sales decision agent. Decide whether to call tools or provide a final response.'
    });
    
    // 4. Set up event listener BEFORE running the node
    console.log('📡 Setting up event listener...\n');
    eventStreamer.subscribe('sales_demo', (event) => {
        console.log(`[${event.type.toUpperCase()}] ${event.nodeId}: ${JSON.stringify(event.content)}`);
    });
    
    // 5. Prepare shared storage
    const sharedStorage = {
        messages: [{ 
            role: 'user' as const, 
            content: 'I need a quote for a 10 amp MCB, C curve' 
        }],
        available_tools: available_tools,
        tool_manager: mcp_server_manager
    };
    
    // 6. Run the node - it will emit events automatically
    console.log('🚀 Running DecisionNode (will emit events)...\n');
    
    const prepRes = await decisionNode.prep(sharedStorage);
    const execRes = await decisionNode.exec(prepRes);
    const postRes = await decisionNode.post(sharedStorage, prepRes, execRes);
    
    console.log('\n✅ Node execution completed');
    console.log('📊 Final result:', postRes);
    
    // 7. Clean up
    await mcp_server_manager.disconnect();
    eventStreamer.clearAll();
}

main().catch(console.error);
