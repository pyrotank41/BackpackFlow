import { SharedStorage, sendMCPMessage, MCPServerManager, MCPServerConfig } from './mcp-core';

// Example MCP server configurations
const serverConfigs: MCPServerConfig[] = [
    {
        name: 'filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', './'],
        transport: 'stdio'
    },
    // You can add more servers here:
    // {
    //     name: 'memory',
    //     command: 'npx',
    //     args: ['@modelcontextprotocol/server-memory'],
    //     transport: 'stdio'
    // },
    // {
    //     name: 'web-search',
    //     url: 'http://localhost:3001/mcp',
    //     transport: 'sse'
    // }
];

async function main() {
    console.log('🚀 Starting MCP-enabled PocketFlow Agent...\n');

    // Initialize MCP manager
    const mcpManager = new MCPServerManager();
    
    // Create shared storage for conversation
    const shared: SharedStorage = {
        messages: [],
        availableTools: [],
        connectedServers: []
    };

    try {
        // Example conversations showing different capabilities
        console.log('='.repeat(50));
        console.log('📁 File System Operations');
        console.log('='.repeat(50));
        
        await sendMCPMessage(
            shared, 
            "Can you read the package.json file and tell me what dependencies we have?",
            mcpManager,
            serverConfigs
        );
        
        displayConversation(shared);
        
        console.log('\n' + '='.repeat(50));
        console.log('📝 File Writing Operations');
        console.log('='.repeat(50));
        
        await sendMCPMessage(
            shared,
            "Create a new file called 'test.txt' with the content 'Hello from MCP!'",
            mcpManager
        );
        
        displayLatestExchange(shared);
        
        console.log('\n' + '='.repeat(50));
        console.log('📂 Directory Listing');
        console.log('='.repeat(50));
        
        await sendMCPMessage(
            shared,
            "List all files in the current directory",
            mcpManager
        );
        
        displayLatestExchange(shared);
        
        console.log('\n' + '='.repeat(50));
        console.log('💬 Conversational (No Tools)');
        console.log('='.repeat(50));
        
        await sendMCPMessage(
            shared,
            "What do you think about the future of AI?",
            mcpManager
        );
        
        displayLatestExchange(shared);

    } catch (error) {
        console.error('❌ Error running MCP agent:', error);
    } finally {
        // Clean up connections
        await mcpManager.disconnect();
        console.log('\n👋 MCP Agent finished');
    }
}

function displayConversation(shared: SharedStorage) {
    console.log('\n📋 Full Conversation History:');
    console.log('-'.repeat(40));
    
    shared.messages.forEach((msg, index) => {
        const prefix = msg.role === 'user' ? '👤 You' : '🤖 AI';
        const color = msg.role === 'user' ? '\x1b[36m' : '\x1b[32m'; // Cyan for user, Green for AI
        const reset = '\x1b[0m';
        
        console.log(`${color}${prefix}: ${msg.content}${reset}`);
        
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            msg.toolCalls.forEach(call => {
                console.log(`   🔧 Used tool: ${call.toolName}`);
                console.log(`   📝 Arguments: ${JSON.stringify(call.arguments, null, 2)}`);
            });
        }
        
        if (index < shared.messages.length - 1) {
            console.log(); // Add spacing between messages
        }
    });
    
    console.log('-'.repeat(40));
}

function displayLatestExchange(shared: SharedStorage) {
    console.log('\n💬 Latest Exchange:');
    console.log('-'.repeat(30));
    
    if (shared.messages.length >= 2) {
        const userMsg = shared.messages[shared.messages.length - 2];
        const aiMsg = shared.messages[shared.messages.length - 1];
        
        console.log(`\x1b[36m👤 You: ${userMsg.content}\x1b[0m`);
        
        if (aiMsg.toolCalls && aiMsg.toolCalls.length > 0) {
            aiMsg.toolCalls.forEach(call => {
                console.log(`   🔧 Used tool: ${call.toolName}`);
            });
        }
        
        console.log(`\x1b[32m🤖 AI: ${aiMsg.content}\x1b[0m`);
    }
    
    console.log('-'.repeat(30));
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
