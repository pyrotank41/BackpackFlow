# Building MCP-Enabled AI Agents with PocketFlow 🔧

*Part of PocketFlow Cookbook - Integrating Model Context Protocol (MCP) for Dynamic Tool Access*

Welcome to the MCP (Model Context Protocol) integration cookbook! In this tutorial, we'll build AI agents that can dynamically discover, connect to, and use external tools through the MCP standard. By the end, you'll have a working agent that can interact with file systems, databases, APIs, and more through MCP servers.

## What We're Building 🎯

We're going to create a sophisticated AI agent system with:
1. **MCP Server Discovery** - Automatically find and connect to MCP servers
2. **Dynamic Tool Loading** - Discover available tools from connected servers
3. **Intelligent Tool Selection** - Let the AI choose which tools to use
4. **Interactive Agent** - A conversational agent that can perform real-world tasks

All built using PocketFlow's modular architecture with proper separation of concerns!

## What is MCP? 🤔

Model Context Protocol (MCP) is an open standard that enables AI models to securely access external tools and data sources. Think of it as a universal API that lets your AI agents:

- 📁 **File Operations** - Read, write, and manage files
- 🗄️ **Database Access** - Query and update databases  
- 🌐 **Web APIs** - Interact with REST APIs and web services
- 💻 **System Tools** - Execute commands and scripts
- 🔧 **Custom Tools** - Any functionality exposed via MCP

**Key Benefits:**
- **Standardized**: One protocol for all tool integrations
- **Secure**: Built-in permission and sandboxing controls
- **Discoverable**: Tools self-describe their capabilities
- **Composable**: Mix and match tools from different providers

## Prerequisites 📋

- Node.js 18+ installed
- Basic TypeScript knowledge
- An OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- Understanding of PocketFlow basics (see [simple-chatbot tutorial](../simple-chatbot/README.md))

## The Architecture: MCP + PocketFlow 🏗️

Our system follows this flow:

```
User Request → MCP Discovery Node → Tool Selection Node → Tool Execution Node → Response Node
       ↓              ↓                    ↓                     ↓               ↓
   Shared Storage ← Available Tools ← Selected Tool ← Tool Results ← Final Response
```

**Components:**
- **MCPDiscoveryNode**: Finds and connects to MCP servers
- **ToolSelectionNode**: Analyzes user intent and picks appropriate tools
- **ToolExecutionNode**: Executes the selected tool with proper parameters
- **ResponseNode**: Formats results into natural language responses
- **Shared Storage**: Maintains conversation context and tool states

## Step 1: Setting Up Your Environment 🏗️

First, let's get our project ready:

```bash
# Install core dependencies
npm install dotenv openai @types/node readline

# Install MCP-specific dependencies
npm install @modelcontextprotocol/sdk ws

# Create your environment file
echo "OPENAI_API_KEY=your-api-key-here" > .env
```

> ⚠️ **Important**: Replace `your-api-key-here` with your actual OpenAI API key!

## Step 2: Understanding MCP Integration 🧠

Let's break down how MCP works with PocketFlow:

### MCP Server Connection
```typescript
// MCP servers expose tools via standardized protocols
const server = new MCPClient({
  url: 'mcp://localhost:3001',
  transport: 'websocket'
});

// Discover available tools
const tools = await server.listTools();
// Result: [{ name: 'read_file', description: 'Read file contents' }, ...]
```

### PocketFlow Integration
```typescript
// Our nodes handle different aspects of MCP interaction
class MCPDiscoveryNode extends Node<SharedStorage> {
  async prep() { /* Connect to MCP servers */ }
  async exec() { /* Discover available tools */ }
  async post() { /* Store tools in shared storage */ }
}
```

### Tool Execution Flow
```
1. User: "Can you read the README.md file?"
2. Discovery: Find file system MCP server
3. Selection: Choose 'read_file' tool
4. Execution: Call read_file('/path/README.md')
5. Response: Format file contents for user
```

## Step 3: Core Components 🔧

### Data Types

Let's define our core data structures:

```typescript
// MCP Tool Definition
export type MCPTool = {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    serverId: string;
}

// Tool Execution Request
export type ToolRequest = {
    toolName: string;
    parameters: Record<string, any>;
    serverId: string;
}

// Tool Execution Result
export type ToolResult = {
    success: boolean;
    result?: any;
    error?: string;
    metadata?: {
        executionTime: number;
        tokensUsed?: number;
    };
}

// Conversation Message
export type Message = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: ToolRequest[];
    toolResults?: ToolResult[];
}

// Shared Storage
export type SharedStorage = {
    messages: Message[];
    availableTools: MCPTool[];
    connectedServers: string[];
    currentRequest?: string;
    pendingTool?: ToolRequest;
}
```

### MCP Server Manager

Our central MCP management system:

```typescript
export class MCPServerManager {
    private servers: Map<string, MCPClient> = new Map();
    
    async connectToServer(url: string, serverId: string): Promise<void> {
        const client = new MCPClient({ url });
        await client.connect();
        this.servers.set(serverId, client);
    }
    
    async discoverTools(): Promise<MCPTool[]> {
        const allTools: MCPTool[] = [];
        
        for (const [serverId, client] of this.servers) {
            const tools = await client.listTools();
            allTools.push(...tools.map(tool => ({
                ...tool,
                serverId
            })));
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
                request.parameters
            );
            
            return {
                success: true,
                result: result.content,
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
```

## Step 4: Building the PocketFlow Nodes 🔗

### MCP Discovery Node

Handles server connections and tool discovery:

```typescript
export class MCPDiscoveryNode extends Node<SharedStorage> {
    constructor(
        private serverUrls: string[] = ['mcp://localhost:3001'],
        private mcpManager: MCPServerManager
    ) {
        super();
    }

    async prep(shared: SharedStorage): Promise<string[]> {
        // Return list of server URLs to connect to
        return this.serverUrls;
    }
    
    async exec(serverUrls: string[]): Promise<{servers: string[], tools: MCPTool[]}> {
        const connectedServers: string[] = [];
        
        // Connect to each MCP server
        for (const [index, url] of serverUrls.entries()) {
            try {
                const serverId = `server_${index}`;
                await this.mcpManager.connectToServer(url, serverId);
                connectedServers.push(serverId);
            } catch (error) {
                console.warn(`Failed to connect to ${url}:`, error);
            }
        }
        
        // Discover all available tools
        const tools = await this.mcpManager.discoverTools();
        
        return { servers: connectedServers, tools };
    }
    
    async post(
        shared: SharedStorage, 
        prepRes: string[], 
        execRes: {servers: string[], tools: MCPTool[]}
    ): Promise<string | undefined> {
        // Store connected servers and available tools
        shared.connectedServers = execRes.servers;
        shared.availableTools = execRes.tools;
        
        console.log(`Connected to ${execRes.servers.length} MCP servers`);
        console.log(`Discovered ${execRes.tools.length} tools`);
        
        return 'tool_selection'; // Next node
    }
}
```

### Tool Selection Node

Uses AI to choose the right tool for the user's request:

```typescript
export class ToolSelectionNode extends Node<SharedStorage> {
    async prep(shared: SharedStorage): Promise<{
        userMessage: string,
        availableTools: MCPTool[]
    }> {
        const lastMessage = shared.messages[shared.messages.length - 1];
        return {
            userMessage: lastMessage?.content || '',
            availableTools: shared.availableTools
        };
    }
    
    async exec(data: {userMessage: string, availableTools: MCPTool[]}): Promise<ToolRequest | null> {
        if (data.availableTools.length === 0) {
            return null; // No tools available
        }
        
        // Create a prompt for the AI to select the right tool
        const toolDescriptions = data.availableTools.map(tool => 
            `- ${tool.name}: ${tool.description}`
        ).join('\n');
        
        const prompt = `
Given the user request: "${data.userMessage}"

Available tools:
${toolDescriptions}

If the user's request can be fulfilled by one of these tools, respond with a JSON object:
{
  "toolName": "exact_tool_name",
  "parameters": { /* parameters based on tool schema */ },
  "reasoning": "why this tool was chosen"
}

If no tool is appropriate, respond with:
{
  "toolName": null,
  "reasoning": "why no tool is suitable"
}
        `.trim();
        
        const response = await callLLM([
            { role: 'system', content: 'You are a tool selection expert. Analyze requests and select appropriate tools.' },
            { role: 'user', content: prompt }
        ]);
        
        try {
            const selection = JSON.parse(response);
            
            if (!selection.toolName) {
                return null;
            }
            
            const tool = data.availableTools.find(t => t.name === selection.toolName);
            if (!tool) {
                return null;
            }
            
            return {
                toolName: selection.toolName,
                parameters: selection.parameters || {},
                serverId: tool.serverId
            };
        } catch (error) {
            console.error('Failed to parse tool selection:', error);
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
```

### Tool Execution Node

Executes the selected tool and handles results:

```typescript
export class ToolExecutionNode extends Node<SharedStorage> {
    constructor(private mcpManager: MCPServerManager) {
        super();
    }

    async prep(shared: SharedStorage): Promise<ToolRequest | null> {
        return shared.pendingTool || null;
    }
    
    async exec(toolRequest: ToolRequest | null): Promise<ToolResult | null> {
        if (!toolRequest) {
            return null;
        }
        
        return await this.mcpManager.executeTool(toolRequest);
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
```

### Response Generation Node

Formats tool results into natural language:

```typescript
export class ResponseGenerationNode extends Node<SharedStorage> {
    async prep(shared: SharedStorage): Promise<{
        conversation: Message[],
        lastToolResult?: ToolResult
    }> {
        const lastMessage = shared.messages[shared.messages.length - 1];
        const lastToolResult = lastMessage?.toolResults?.[0];
        
        return {
            conversation: shared.messages,
            lastToolResult
        };
    }
    
    async exec(data: {conversation: Message[], lastToolResult?: ToolResult}): Promise<string> {
        let systemPrompt = 'You are a helpful AI assistant that can use various tools to help users.';
        
        if (data.lastToolResult) {
            if (data.lastToolResult.success) {
                systemPrompt += ` I just executed a tool successfully. Format the results naturally for the user.`;
            } else {
                systemPrompt += ` I tried to execute a tool but it failed. Explain what went wrong and suggest alternatives.`;
            }
        }
        
        const messages: Message[] = [
            { role: 'system', content: systemPrompt },
            ...data.conversation
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
        
        return undefined; // End the flow
    }
}
```

## Step 5: Creating the MCP Flow 🎭

Now let's orchestrate all our nodes:

```typescript
export class MCPAgentFlow extends Flow<SharedStorage> {
    constructor(
        userMessage: string,
        mcpManager: MCPServerManager,
        serverUrls?: string[]
    ) {
        // Create our node chain
        const discoveryNode = new MCPDiscoveryNode(serverUrls, mcpManager);
        const selectionNode = new ToolSelectionNode();
        const executionNode = new ToolExecutionNode(mcpManager);
        const responseNode = new ResponseGenerationNode();
        
        // Set up the flow transitions
        discoveryNode.setNext('tool_selection', selectionNode);
        selectionNode.setNext('tool_execution', executionNode);
        selectionNode.setNext('direct_response', responseNode);
        executionNode.setNext('response_generation', responseNode);
        
        super(discoveryNode);
    }
}
```

## Step 6: Putting It All Together 🎪

Here's our complete MCP-enabled agent:

```typescript
async function main() {
    // Initialize MCP manager
    const mcpManager = new MCPServerManager();
    
    // Create shared storage
    const shared: SharedStorage = {
        messages: [],
        availableTools: [],
        connectedServers: []
    };
    
    // Send a message
    await sendMCPMessage(
        shared, 
        "Can you read the package.json file and tell me what dependencies we have?",
        mcpManager
    );
    
    // Display conversation
    console.log('Conversation:');
    shared.messages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
        
        if (msg.toolCalls) {
            msg.toolCalls.forEach(call => {
                console.log(`   🔧 Used tool: ${call.toolName}`);
            });
        }
    });
}

export async function sendMCPMessage(
    shared: SharedStorage, 
    message: string,
    mcpManager: MCPServerManager,
    serverUrls?: string[]
): Promise<string> {
    // Add user message
    shared.messages.push({ role: 'user', content: message });
    
    // Run the flow
    const flow = new MCPAgentFlow(message, mcpManager, serverUrls);
    await flow.run(shared);
    
    // Return the last assistant message
    const lastMessage = shared.messages[shared.messages.length - 1];
    return lastMessage.role === 'assistant' ? lastMessage.content : '';
}
```

## Step 7: Advanced Features 🚀

### Server Health Monitoring
```typescript
class MCPHealthNode extends Node<SharedStorage> {
    async exec(): Promise<{healthy: string[], unhealthy: string[]}> {
        // Check health of all connected servers
        // Reconnect failed servers
        // Update available tools list
    }
}
```

### Tool Caching
```typescript
class ToolCacheNode extends Node<SharedStorage> {
    async exec(): Promise<void> {
        // Cache frequently used tool results
        // Implement intelligent cache invalidation
        // Reduce API calls for repeated requests
    }
}
```

### Permission Management
```typescript
class PermissionNode extends Node<SharedStorage> {
    async exec(toolRequest: ToolRequest): Promise<boolean> {
        // Check if tool execution is allowed
        // Implement role-based access control
        // Log security events
    }
}
```

## Step 8: Running Your MCP Agent 🎮

```bash
# Start an MCP server (example: file system server)
npx @modelcontextprotocol/server-filesystem /path/to/files

# In another terminal, run your agent
npx ts-node mcp-agent.ts
```

You should see output like:
```
Connected to 1 MCP servers
Discovered 5 tools
Conversation:
1. user: Can you read the package.json file and tell me what dependencies we have?
🔧 Used tool: read_file
2. assistant: I've read your package.json file. Here are your dependencies:

**Production Dependencies:**
- dotenv: ^16.0.0 - Environment variable management
- openai: ^4.0.0 - OpenAI API client
...
```

## Why MCP + PocketFlow is Powerful 🌟

**Traditional Tool Integration:**
```typescript
// Hard-coded, inflexible
if (userWants === 'read_file') {
    const result = await fs.readFile(filename);
} else if (userWants === 'database_query') {
    const result = await db.query(sql);
}
// Add more tools = more if/else statements
```

**MCP + PocketFlow Approach:**
```typescript
// Dynamic, discoverable, composable
const tools = await mcpManager.discoverTools();  // Find all available tools
const selectedTool = await ai.selectTool(tools); // AI chooses best tool
const result = await mcpManager.executeTool(selectedTool); // Execute dynamically
```

**Benefits:**
- 🔌 **Plugin Architecture**: Add new tools without code changes
- 🤖 **AI-Driven**: Let the AI decide which tools to use
- 🔒 **Secure**: Built-in permissions and sandboxing
- 🧪 **Testable**: Each node can be tested independently
- 📈 **Scalable**: Easily add more servers and tools

## Common MCP Servers 🛠️

Your agent can connect to various MCP servers:

- **File System**: Read/write files, list directories
- **Database**: Query SQL databases, NoSQL stores  
- **Web APIs**: REST/GraphQL API interactions
- **Git**: Repository operations, commit history
- **Docker**: Container management
- **Cloud Services**: AWS, GCP, Azure integrations
- **Custom Tools**: Build your own MCP servers

## What's Next? 🛣️

Now that you have a working MCP agent, explore:

- **Multi-Server Agents**: Connect to multiple MCP servers simultaneously
- **Tool Composition**: Chain tools together for complex workflows
- **Interactive Permissions**: Ask users before executing sensitive tools
- **Custom MCP Servers**: Build your own tools and services
- **Agent Specialization**: Create domain-specific agents (DevOps, Data Analysis, etc.)

## Key Takeaways 💡

1. **MCP provides standardization** - One protocol for all tool integrations
2. **PocketFlow provides structure** - Clean separation of discovery, selection, and execution
3. **AI drives tool selection** - Let the model choose the right tool for each task
4. **Modularity enables growth** - Add new capabilities without breaking existing code

## Troubleshooting 🔧

**Common Issues:**

1. **"MCP server connection failed"** - Check server is running and URL is correct
2. **"Tool not found"** - Ensure tool discovery ran successfully
3. **"Permission denied"** - Check MCP server permissions and authentication
4. **"Tool execution timeout"** - Implement proper timeout handling

## Files in This Example 📁

- `mcp-agent.ts` - Main agent implementation
- `mcp-core.ts` - Core MCP integration components
- `mcp-nodes.ts` - PocketFlow nodes for MCP operations
- `mcp-demo.ts` - Interactive demo application
- `package.json` - Dependencies and scripts
- `.env` - Configuration (create this!)

## Ready to Build Tool-Enabled Agents? 🚀

You now have the foundation to build AI agents that can interact with the real world through MCP! This cookbook demonstrates how PocketFlow's modular architecture makes complex tool integrations manageable and testable.

Try building agents for:
- **DevOps Automation**: Deploy code, manage infrastructure
- **Data Analysis**: Query databases, generate reports  
- **Content Management**: Process files, update documentation
- **System Administration**: Monitor services, manage configurations

The possibilities are endless when your AI can use real tools! 🎉

---

*Next in the cookbook: Building Multi-Agent Systems - Where multiple specialized agents collaborate to solve complex problems.*

---

## Run Commands 🏃‍♂️

```bash
# Install dependencies
npm install

# Start MCP file server (in separate terminal)
npx @modelcontextprotocol/server-filesystem ./

# Run basic MCP agent
npx ts-node mcp-agent.ts

# Run interactive demo
npx ts-node mcp-demo.ts
```

Remember to set your OpenAI API key in the `.env` file and start MCP servers before running the agent!
