import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '.env') });
import OpenAI from 'openai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPAgentFlow } from './mcp-nodes';

// MCP Tool Definition
export type MCPTool = {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    serverId: string;
}

// Tool Execution Request
export type ToolRequest = {
    toolName: string;
    arguments: Record<string, any>;
    serverId: string;
}

// Tool Execution Result
export type ToolResult = {
    success: boolean;
    content?: any;
    error?: string;
    metadata?: {
        executionTime: number;
        isError?: boolean;
    };
}

// Conversation Message
export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolRequest[];
    toolResults?: ToolResult[];
}

// MCP Server Configuration
export type MCPServerConfig = {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    transport: 'stdio' | 'sse';
}

// Shared Storage
export type SharedStorage = {
    messages: Message[];
    availableTools: MCPTool[];
    connectedServers: string[];
    currentRequest?: string;
    pendingTool?: ToolRequest;
}

// MCP Client Wrapper
class MCPClientWrapper {
    private client: Client;
    private transport: StdioClientTransport | SSEClientTransport;
    private connected: boolean = false;
    public config: MCPServerConfig;

    constructor(config: MCPServerConfig) {
        this.config = config;
        
        if (config.transport === 'stdio' && config.command) {
            this.transport = new StdioClientTransport({
                command: config.command,
                args: config.args || [],
                env: config.env
            });
        } else if (config.transport === 'sse' && config.url) {
            this.transport = new SSEClientTransport(new URL(config.url));
        } else {
            throw new Error('Invalid MCP server configuration: missing command for stdio or url for sse transport');
        }
        
        this.client = new Client(
            {
                name: "pocketflow-mcp-client",
                version: "1.0.0"
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );
    }

    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }

        try {
            await this.client.connect(this.transport);
            this.connected = true;
            console.log(`✅ Connected to MCP server: ${this.config.name}`);
        } catch (error) {
            console.error(`❌ Failed to connect to MCP server ${this.config.name}:`, error);
            throw error;
        }
    }

    async listTools(): Promise<Omit<MCPTool, 'serverId'>[]> {
        if (!this.connected) {
            throw new Error('Not connected to MCP server');
        }

        try {
            const response = await this.client.listTools();
            console.log('🔍 List Tools Response:', response);
            return response.tools.map(tool => ({
                name: tool.name,
                description: tool.description || '',
                inputSchema: tool.inputSchema as any
            }));
        } catch (error) {
            console.error(`Failed to list tools from ${this.config.name}:`, error);
            throw error;
        }
    }

    async callTool(toolName: string, arguments_: Record<string, any>): Promise<{ content: any }> {
        if (!this.connected) {
            throw new Error('Not connected to MCP server');
        }

        try {
            const response = await this.client.callTool({
                name: toolName,
                arguments: arguments_
            });

            return {
                content: response.content
            };
        } catch (error) {
            console.error(`Failed to call tool ${toolName}:`, error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.client.close();
            this.connected = false;
            console.log(`Disconnected from MCP server: ${this.config.name}`);
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}

// MCP Server Manager
export class MCPServerManager {
    private servers: Map<string, MCPClientWrapper> = new Map();
    
    async connectToServer(config: MCPServerConfig, serverId: string): Promise<void> {
        const client = new MCPClientWrapper(config);
        await client.connect();
        this.servers.set(serverId, client);
    }
    
    async discoverTools(): Promise<MCPTool[]> {
        const allTools: MCPTool[] = [];
        
        for (const [serverId, client] of this.servers) {
            try {
                const tools = await client.listTools();
                allTools.push(...tools.map(tool => ({
                    ...tool,
                    serverId
                })));
            } catch (error) {
                console.warn(`Failed to discover tools from ${serverId}:`, error);
            }
        }
        
        return allTools;
    }
    
    async executeTool(request: ToolRequest): Promise<ToolResult> {
        const client = this.servers.get(request.serverId);
        if (!client) {
            return {
                success: false,
                error: `Server ${request.serverId} not connected`
            };
        }
        
        try {
            const startTime = Date.now();
            const result = await client.callTool(
                request.toolName, 
                request.arguments
            );
            
            return {
                success: true,
                content: result.content,
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: {
                    executionTime: Date.now() - Date.now(),
                    isError: true
                }
            };
        }
    }

    getConnectedServers(): string[] {
        return Array.from(this.servers.keys());
    }

    async disconnect(): Promise<void> {
        for (const [serverId, client] of this.servers) {
            try {
                await client.disconnect();
            } catch (error) {
                console.warn(`Failed to disconnect from ${serverId}:`, error);
            }
        }
        this.servers.clear();
        console.log('Disconnected from all MCP servers');
    }

    getServerConfig(serverId: string): MCPServerConfig | undefined {
        const client = this.servers.get(serverId);
        return client?.config;
    }
}

// Helper function to call LLM
export async function callLLM(messages: Message[]): Promise<string> {
    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
    });

    const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
    });
    return completion.choices[0].message.content ?? '';
}

// Utility function to send a message through the MCP flow
export async function sendMCPMessage(
    shared: SharedStorage, 
    message: string,
    mcpManager: MCPServerManager,
    serverConfigs?: MCPServerConfig[]
): Promise<string> {
    // Add user message
    shared.messages.push({ role: 'user', content: message });
    
    // Run the flow
    const flow = new MCPAgentFlow(message, mcpManager, serverConfigs);
    await flow.run(shared);
    
    // Return the last assistant message
    const lastMessage = shared.messages[shared.messages.length - 1];
    return lastMessage.role === 'assistant' ? lastMessage.content : '';
}
