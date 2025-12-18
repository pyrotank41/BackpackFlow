import { Node, Flow } from '../../../src/pocketflow';
import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import { z } from 'zod';
import { 
    MCPTool, 
    ToolRequest, 
    ToolResult, 
    Message, 
    SharedStorage, 
    MCPServerManager,
    MCPServerConfig,
    callLLM 
} from './mcp-core';

// MCP Discovery Node - Handles server connections and tool discovery
export class MCPDiscoveryNode extends Node<SharedStorage> {
    constructor(
        private serverConfigs: MCPServerConfig[] = [
            {
                name: 'filesystem',
                command: 'npx',
                args: ['@modelcontextprotocol/server-filesystem', './'],
                transport: 'stdio'
            }
        ],
        private mcpManager: MCPServerManager
    ) {
        super();
    }

    async prep(shared: SharedStorage): Promise<MCPServerConfig[]> {
        console.log('🔍 Starting MCP server discovery...');
        return this.serverConfigs;
    }
    
    async exec(serverConfigs: MCPServerConfig[]): Promise<{servers: string[], tools: MCPTool[]}> {
        const connectedServers: string[] = [];
        
        console.log(`Attempting to connect to ${serverConfigs.length} MCP servers...`);
        
        // Connect to each MCP server
        for (const [index, config] of serverConfigs.entries()) {
            try {
                const serverId = `server_${index}_${config.name}`;
                await this.mcpManager.connectToServer(config, serverId);
                connectedServers.push(serverId);
                console.log(`✅ Connected to server: ${serverId} (${config.name})`);
            } catch (error) {
                console.warn(`❌ Failed to connect to ${config.name}:`, error instanceof Error ? error.message : error);
            }
        }
        
        // Discover all available tools
        const tools = await this.mcpManager.discoverTools();
        
        return { servers: connectedServers, tools };
    }
    
    async post(
        shared: SharedStorage, 
        prepRes: MCPServerConfig[], 
        execRes: {servers: string[], tools: MCPTool[]}
    ): Promise<string | undefined> {
        // Store connected servers and available tools
        shared.connectedServers = execRes.servers;
        shared.availableTools = execRes.tools;
        
        console.log(`🎉 Connected to ${execRes.servers.length} MCP servers`);
        console.log(`🔧 Discovered ${execRes.tools.length} tools:`);
        execRes.tools.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description}`);
        });
        
        return 'tool_selection'; // Next node
    }
}

// Schema for tool selection
const ToolSelectionSchema = z.object({
    toolName: z.string().nullable().describe("Name of the tool to use, or null if no tool is needed"),
    parameters: z.record(z.any()).default({}).describe("Parameters for the tool as key-value pairs"),
    reasoning: z.string().describe("Explanation of why this tool was chosen or why no tool is needed")
});

type ToolSelection = z.infer<typeof ToolSelectionSchema>;

// Tool Selection Node - Uses AI to choose the right tool for the user's request
export class ToolSelectionNode extends Node<SharedStorage> {
    private client: any;

    constructor() {
        super();
        const oai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.client = Instructor({
            client: oai,
            mode: "FUNCTIONS"
        });
    }
    async prep(shared: SharedStorage): Promise<{
        userMessage: string,
        availableTools: MCPTool[]
    }> {
        const lastMessage = shared.messages[shared.messages.length - 1];
        console.log('🤔 Analyzing user request for tool selection...');
        
        return {
            userMessage: lastMessage?.content || '',
            availableTools: shared.availableTools
        };
    }
    
    async exec(data: {userMessage: string, availableTools: MCPTool[]}): Promise<ToolRequest | null> {
        if (data.availableTools.length === 0) {
            console.log('❌ No tools available for selection');
            return null;
        }
        
        // Create a detailed prompt for the AI to select the right tool
        const toolDescriptions = data.availableTools.map(tool => 
            `- ${tool.name} (${tool.serverId}): ${tool.description}\n  Parameters: ${JSON.stringify(tool.inputSchema.properties, null, 2)}`
        ).join('\n\n');

        console.log('🔍 Tool Descriptions:', toolDescriptions);
        
        const prompt = `
Analyze this user request and determine if any available tools can help fulfill it.

User Request: "${data.userMessage}"

Available Tools:
${toolDescriptions}

Instructions:
1. If the user's request can be fulfilled by one of these tools:
   - Set toolName to the exact tool name from the list above
   - Set parameters to an object containing the required fields for that tool
   - Look at each tool's parameter schema to determine what fields are needed
   - Use sensible defaults: "." for current directory, infer file paths from user request
   - Ensure all required parameters are provided based on the tool's schema
2. If no tool is appropriate or the request is conversational:
   - Set toolName to null
   - Set parameters to {} (empty object)
3. Always provide clear reasoning for your decision.

CRITICAL: The parameters field is ALWAYS required - provide an object with the tool's parameters or an empty object {}.
        `.trim();
        
        try {
            const selection: ToolSelection = await this.client.chat.completions.create({
                messages: [
                    { 
                        role: 'system', 
                        content: 'You are a tool selection expert. Analyze user requests and select appropriate tools with proper parameters.' 
                    },
                    { role: 'user', content: prompt }
                ],
                model: "gpt-4o",
                response_model: {
                    schema: ToolSelectionSchema,
                    name: "ToolSelection"
                },
                temperature: 0.1
            });
            
            console.log('🤖 AI Tool Selection:', selection);
            
            if (!selection.toolName) {
                console.log('💬 No tool needed - will provide direct response');
                console.log(`Reasoning: ${selection.reasoning}`);
                return null;
            }
            
            const tool = data.availableTools.find(t => t.name === selection.toolName);
            if (!tool) {
                console.log(`❌ Tool not found: ${selection.toolName}`);
                return null;
            }
            
            console.log(`🎯 Selected tool: ${selection.toolName}`);
            console.log(`Arguments:`, selection.parameters);
            console.log(`Reasoning: ${selection.reasoning}`);
            
            return {
                toolName: selection.toolName,
                arguments: selection.parameters || {},
                serverId: tool.serverId
            };
        } catch (error) {
            console.error('❌ Failed to get tool selection:', error);
            return null;
        }
    }
    
    async post(
        shared: SharedStorage, 
        prepRes: any, 
        execRes: ToolRequest | null
    ): Promise<string | undefined> {
        if (execRes) {
            shared.pendingTool = execRes;
            return 'tool_execution'; // Execute the tool
        } else {
            return 'direct_response'; // No tool needed, respond directly
        }
    }
}

// Tool Execution Node - Executes the selected tool and handles results
export class ToolExecutionNode extends Node<SharedStorage> {
    constructor(private mcpManager: MCPServerManager) {
        super();
    }

    async prep(shared: SharedStorage): Promise<ToolRequest | null> {
        const toolRequest = shared.pendingTool || null;
        if (toolRequest) {
            console.log(`⚡ Preparing to execute tool: ${toolRequest.toolName}`);
        }
        return toolRequest;
    }
    
    async exec(toolRequest: ToolRequest | null): Promise<ToolResult | null> {
        if (!toolRequest) {
            return null;
        }
        
        console.log(`🔧 Executing tool: ${toolRequest.toolName}`);
        console.log(`Arguments:`, toolRequest.arguments);
        
        const result = await this.mcpManager.executeTool(toolRequest);
        
        if (result.success) {
            console.log(`✅ Tool executed successfully in ${result.metadata?.executionTime}ms`);
        } else {
            console.log(`❌ Tool execution failed: ${result.error}`);
        }
        
        return result;
    }
    
    async post(
        shared: SharedStorage, 
        prepRes: ToolRequest | null, 
        execRes: ToolResult | null
    ): Promise<string | undefined> {
        if (execRes && prepRes) {
            // Add tool call and result to message history
            const lastMessage = shared.messages[shared.messages.length - 1];
            if (lastMessage) {
                lastMessage.toolCalls = [prepRes];
                lastMessage.toolResults = [execRes];
            }
        }
        
        // Clear pending tool
        shared.pendingTool = undefined;
        
        return 'response_generation'; // Generate final response
    }
}

// Response Generation Node - Formats tool results into natural language
export class ResponseGenerationNode extends Node<SharedStorage> {
    async prep(shared: SharedStorage): Promise<{
        conversation: Message[],
        lastToolResult?: ToolResult,
        lastToolRequest?: ToolRequest
    }> {
        const lastMessage = shared.messages[shared.messages.length - 1];
        const lastToolResult = lastMessage?.toolResults?.[0];
        const lastToolRequest = lastMessage?.toolCalls?.[0];
        
        console.log('💭 Generating response...');
        
        return {
            conversation: shared.messages,
            lastToolResult,
            lastToolRequest
        };
    }
    
    async exec(data: {
        conversation: Message[], 
        lastToolResult?: ToolResult,
        lastToolRequest?: ToolRequest
    }): Promise<string> {
        let systemPrompt = `You are a helpful AI assistant that can use various tools to help users. 
Be conversational, helpful, and explain what you did when you used tools.`;
        
        if (data.lastToolResult && data.lastToolRequest) {
            if (data.lastToolResult.success) {
                systemPrompt += `

I just executed the tool "${data.lastToolRequest.toolName}" successfully. 
Tool arguments used: ${JSON.stringify(data.lastToolRequest.arguments)}
Tool result: ${JSON.stringify(data.lastToolResult.content)}

Format this result naturally for the user. Explain what the tool did and present the results in a clear, helpful way.`;
            } else {
                systemPrompt += `

I tried to execute the tool "${data.lastToolRequest.toolName}" but it failed.
Error: ${data.lastToolResult.error}

Explain what went wrong in a helpful way and suggest alternatives if possible.`;
            }
        } else {
            systemPrompt += `

No tool was needed for this request. Provide a helpful, conversational response.`;
        }
        
        const messages: Message[] = [
            { role: 'system', content: systemPrompt },
            ...data.conversation.map(msg => ({
                role: msg.role,
                content: msg.content
            } as Message))
        ];
        
        return await callLLM(messages);
    }
    
    async post(
        shared: SharedStorage, 
        prepRes: any, 
        execRes: string
    ): Promise<string | undefined> {
        // Add AI response to conversation
        shared.messages.push({
            role: 'assistant',
            content: execRes
        });
        
        console.log('✨ Response generated and added to conversation');
        
        return undefined; // End the flow
    }
}

// MCP Agent Flow - Orchestrates all the nodes
export class MCPAgentFlow extends Flow<SharedStorage> {
    constructor(
        userMessage: string,
        mcpManager: MCPServerManager,
        serverConfigs?: MCPServerConfig[]
    ) {
        // Create our node chain
        const discoveryNode = new MCPDiscoveryNode(serverConfigs, mcpManager);
        const selectionNode = new ToolSelectionNode();
        const executionNode = new ToolExecutionNode(mcpManager);
        const responseNode = new ResponseGenerationNode();
        
        // Set up the flow transitions
        discoveryNode.on('tool_selection', selectionNode);
        selectionNode.on('tool_execution', executionNode);
        selectionNode.on('direct_response', responseNode);
        executionNode.on('response_generation', responseNode);
        
        super(discoveryNode);
    }
}

