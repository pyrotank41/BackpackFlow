# MCP PocketFlow Cookbook - Quick Start 🚀

Get up and running with MCP-enabled AI agents in minutes!

## 🏃‍♂️ Quick Setup

### 1. Install Dependencies
```bash
cd tutorials/pocketflow-cookbook-ts/mcp
npm install
```

### 2. Install MCP Servers
```bash
# Install the filesystem MCP server globally
npm install -g @modelcontextprotocol/server-filesystem

# Optional: Install other MCP servers
npm install -g @modelcontextprotocol/server-memory
```

### 3. Set Up Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your OpenAI API key
echo "OPENAI_API_KEY=your-actual-api-key-here" > .env
```

### 4. Run the Examples

#### Basic Agent (One-shot examples)
```bash
npm start
# or
npx ts-node mcp-agent.ts
```

#### Interactive Demo
```bash
npm run demo
# or
npx ts-node mcp-demo.ts
```

## 🎯 What You'll See

The agent will:
1. **Connect** to MCP servers (like filesystem)
2. **Discover** available tools automatically
3. **Choose** the right tool based on your request
4. **Execute** the tool with proper parameters
5. **Format** results in natural language

## 💬 Try These Commands

In the interactive demo, try:

### File Operations
- "Read the package.json file"
- "List all files in this directory"  
- "Create a file called test.txt with hello world"

### Conversational
- "What do you think about AI?"
- "Explain how MCP works"

### Meta Commands
- `tools` - See available tools
- `servers` - See connected servers
- `history` - View conversation
- `clear` - Clear history

## 🔧 Architecture Overview

```
User Request → Discovery → Tool Selection → Tool Execution → Response
     ↓            ↓            ↓              ↓             ↓
SharedStorage ← Connect ← AI Chooses ← MCP Execute ← Format Result
```

**Key Components:**
- **MCPDiscoveryNode**: Connects to MCP servers
- **ToolSelectionNode**: AI picks the right tool
- **ToolExecutionNode**: Executes via MCP
- **ResponseGenerationNode**: Formats results

## 📁 Files Structure

```
mcp/
├── README.md           # Full tutorial and documentation
├── QUICKSTART.md       # This file
├── mcp-core.ts         # Core MCP integration & types
├── mcp-nodes.ts        # PocketFlow nodes for MCP
├── mcp-agent.ts        # Basic example agent
├── mcp-demo.ts         # Interactive terminal demo
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── env.example         # Environment template
```

## 🚨 Troubleshooting

### "OpenAI API key missing"
- Make sure `.env` file exists with `OPENAI_API_KEY=your-key`

### "MCP server connection failed"  
- Install MCP servers: `npm install -g @modelcontextprotocol/server-filesystem`
- Check you're in the right directory

### "Tool execution failed"
- Make sure the filesystem server has access to current directory
- Try simpler commands first like "list files"

## 🌟 What's Special About This?

Unlike traditional chatbots, this agent:
- **Dynamically discovers** tools at runtime
- **AI decides** which tools to use (no hardcoding)
- **Real tool integration** via MCP standard
- **Modular architecture** using PocketFlow nodes
- **Production ready** with proper error handling

## 🚀 Next Steps

1. **Add more MCP servers** - database, web APIs, custom tools
2. **Customize tool selection** - modify the AI prompts
3. **Build specialized agents** - create domain-specific workflows
4. **Scale up** - add multiple servers and complex tool chains

Ready to build the future of AI agents? Start with `npm run demo`! 🎉
