import { Flow } from "../../src/pocketflow";
import { 
    MCPServerManager, 
    MCPServerConfig,
    DecisionNode,
    FinalAnswerNode,
    ToolParamGenerationNode,
    ToolExecutionNode,
    createInstructorClient
} from "../../src/nodes";
import * as readline from 'readline';



import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') }); // Load environment variables from .env file in this directory


const mcp_server_configs: MCPServerConfig[] = [
    
    // for local server
    {
        name: "erp_sales",
        command: "sh",
        args: ["-c", "cd /Users/karansinghkochar/Documents/GitHub/product-quote-mcp && uv run python -m src.standalone_erp_server"],
        transport: "stdio"
    }
    // {
    //     name: "erp_sales_url",
    //     url: "http://localhost:8000/llm/mcp/",
    //     transport: "sse",
    //     bearerToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6InNzb19vaWRjX2tleV9wYWlyXzAxSlowSFYwSkRDQ0o2NksxSzkyNzVIVzJTIn0.eyJhdWQiOiJodHRwczovL2FwaS53b3Jrb3MuY29tIiwiaXNzIjoiaHR0cHM6Ly9hcGkud29ya29zLmNvbSIsInN1YiI6InVzZXJfMDFKWkUwMU41WEpFOEFEMENTMTJCTkM1V0oiLCJzdWJfdHlwZSI6ImF1dGhraXQiLCJqdGkiOiIwMUs1MlhaTlBROTVDNlZTTkFNMjhRUFJEViIsIm9yZ19pZCI6Im9yZ18wMUswUEc5M0Q2RlBBV1FHNDhGMzE3MzJQTiIsInNpZCI6IndpZGdldF9zZXNzaW9uXzAxSzUyWFpOTkZUTlg4TTMyOThGNkhQWDU1IiwicGVybWlzc2lvbnMiOlsid2lkZ2V0czp1c2Vycy10YWJsZTptYW5hZ2UiXSwiZXhwIjoxNzU3ODE3NTIxLCJpYXQiOjE3NTc4MTM5MjF9.My4pWMpsIwUQ1bwk2M0DE8M6yQ4OIen7vY4XKFYVZh0aLRtB_f4BvSOYzFVtTm6ozfayTxPpEVLshiaMSpqB0jTYN_4NxiepcNDMuTsOMbQSNloZyA7CI56STDp9H-9M8tU8Vw0_Rxj9W2GSgj7QMZCvT29DkLAeMew3RQqVRk4OCBIq81o_22IXAvFc0z_fSv0Hu2ejFGeufryds0k-uuF9pouRGEIWs8_FyJMnhpMmNbZ34g1VEVhJW0cCA9inqy0CG75qWyqbttH72l4zemy-9nodH7v0KYULHpeJzrnpPju6fEqVQdtRF_4x8Zmx4x6ZSy_IX4_HABuG-xOm-Q"
    // }
]

async function main() {
    const mcp_server_manager = new MCPServerManager();
    
    await mcp_server_manager.connectToServers(mcp_server_configs);
    const available_tools = await mcp_server_manager.discoverTools();

    const sharedStorage = {
        messages: [{
            role: 'user', content: 'please generate a quote for a 10 amp mcb, c curve and 20 amp mcb, c curve. also, do we have a customer name starting with "prachi"' } ],
        available_tools: available_tools,
        tool_manager: mcp_server_manager
    }
    
    // Create LLM client (explicitly specify provider)
    console.log('🔍 Creating LLM client...');
    const instructorClient = createInstructorClient({ provider: 'openai' });
    
    // Create nodes with custom sales-focused prompts
    const decision_node = new DecisionNode({
        instructorClient: instructorClient,
        systemPrompt: `You are a sales decision agent for PragmaticAI Solutions. Decide whether to call tools or provide a final response.

Decision Guidelines:
- Choose "tool_call_request" if you need to search products, generate quotes, or look up customer information
- Choose "generate_final_response" if you have sufficient information to help the customer
- Be specific about the tools to call to get the most relevant sales information
- Prioritize customer service and accurate product information`
    });
    
    const tool_param_generation_node = new ToolParamGenerationNode({
        instructorClient: instructorClient,
        systemPrompt: `You are a sales tool parameter generation agent for PragmaticAI Solutions. Generate accurate parameters for sales tools like product searches, quote generation, and customer lookups.`
    });
    
    const tool_execution_node = new ToolExecutionNode();
    
    const final_answer_node = new FinalAnswerNode({
        instructorClient: instructorClient,
        systemPrompt: `You are a professional sales assistant for PragmaticAI Solutions. Based on the tool execution results, provide a comprehensive, helpful response to the customer's request.

Guidelines:
- Be clear and professional
- Include specific product details when available (SKU, name, price, etc.)
- Format quotes in a clear, easy-to-read manner
- Address all parts of the customer's request
- If some information wasn't found, mention it politely and offer alternatives
- Use a friendly but professional sales tone
- Always end with an offer to help further`
    });
    
    // Set up the flow connections
    decision_node.on("tool_call_request", tool_param_generation_node);
    decision_node.on("generate_final_response", final_answer_node);
    tool_param_generation_node.on("tool_execution", tool_execution_node);
    tool_execution_node.on("response_generation", final_answer_node);

    const flow = new Flow(decision_node);

    await flow.run(sharedStorage);

    console.log('Flow response:', JSON.stringify(sharedStorage, null, 4));

    await mcp_server_manager.disconnect();
}

main().catch(console.error);