import * as readline from 'readline';
import { SharedStorage, sendMCPMessage, MCPServerManager, MCPServerConfig } from './mcp-core';

class MCPTerminalDemo {
    private rl: readline.Interface;
    private shared: SharedStorage;
    private mcpManager: MCPServerManager;
    private serverConfigs: MCPServerConfig[];

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        
        this.shared = { 
            messages: [], 
            availableTools: [], 
            connectedServers: [] 
        };
        
        this.mcpManager = new MCPServerManager();
        
        // Default MCP server configurations
        this.serverConfigs = [
            {
                name: 'filesystem',
                command: 'npx',
                args: ['@modelcontextprotocol/server-filesystem', './'],
                transport: 'stdio'
            }
            // Add more servers as needed:
            // {
            //     name: 'memory',
            //     command: 'npx',
            //     args: ['@modelcontextprotocol/server-memory'],
            //     transport: 'stdio'
            // }
        ];
    }

    private formatMessage(role: 'user' | 'assistant' | 'system', content: string): string {
        const prefix = role === 'user' ? '👤 You' : role === 'assistant' ? '🤖 AI' : '💬 System';
        const color = role === 'user' ? '\x1b[36m' : role === 'assistant' ? '\x1b[32m' : '\x1b[33m'; // Cyan for user, Green for AI, Yellow for system
        const reset = '\x1b[0m';
        return `${color}${prefix}: ${content}${reset}`;
    }

    private showWelcome(): void {
        console.log('\n🚀 Welcome to PocketFlow MCP Terminal Demo!');
        console.log('🔧 This demo shows how AI agents can use real tools through MCP');
        console.log('💬 Type your messages and the AI will decide if tools are needed');
        console.log('');
        console.log('📝 Example commands to try:');
        console.log('   - "Read the README.md file"');
        console.log('   - "List all files in this directory"');
        console.log('   - "Create a file called hello.txt with some content"');
        console.log('   - "What is the weather like?" (conversational, no tools)');
        console.log('');
        console.log('🔚 Type "exit", "quit", or "bye" to end the conversation');
        console.log('📜 Type "history" to see the full conversation');
        console.log('🧹 Type "clear" to clear the conversation history');
        console.log('🔧 Type "tools" to see available MCP tools');
        console.log('🌐 Type "servers" to see connected MCP servers');
        console.log('-'.repeat(60));
    }

    private showHistory(): void {
        if (this.shared.messages.length === 0) {
            console.log('📭 No conversation history yet. Start chatting!');
            return;
        }

        console.log('\n📜 Conversation History:');
        console.log('-'.repeat(40));
        this.shared.messages.forEach((msg, index) => {
            console.log(`${index + 1}. ${this.formatMessage(msg.role, msg.content)}`);
            
            if (msg.toolCalls && msg.toolCalls.length > 0) {
                msg.toolCalls.forEach(call => {
                    console.log(`    🔧 Used tool: ${call.toolName}`);
                    console.log(`    📝 Arguments: ${JSON.stringify(call.arguments, null, 6)}`);
                });
            }
        });
        console.log('-'.repeat(40));
    }

    private showTools(): void {
        if (this.shared.availableTools.length === 0) {
            console.log('🔧 No tools discovered yet. Tools will be available after your first message.');
            return;
        }

        console.log('\n🔧 Available MCP Tools:');
        console.log('-'.repeat(40));
        this.shared.availableTools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name} (${tool.serverId})`);
            console.log(`   📖 ${tool.description}`);
            console.log(`   📝 Parameters: ${JSON.stringify(tool.inputSchema.properties, null, 6)}`);
            if (tool.inputSchema.required) {
                console.log(`   ⚠️  Required: ${tool.inputSchema.required.join(', ')}`);
            }
            console.log('');
        });
        console.log('-'.repeat(40));
    }

    private showServers(): void {
        if (this.shared.connectedServers.length === 0) {
            console.log('🌐 No MCP servers connected yet. Servers will connect after your first message.');
            return;
        }

        console.log('\n🌐 Connected MCP Servers:');
        console.log('-'.repeat(40));
        this.shared.connectedServers.forEach((serverId, index) => {
            const config = this.mcpManager.getServerConfig(serverId);
            console.log(`${index + 1}. ${serverId}`);
            if (config) {
                console.log(`   📋 Name: ${config.name}`);
                console.log(`   🚀 Transport: ${config.transport}`);
                if (config.command) {
                    console.log(`   💻 Command: ${config.command} ${config.args?.join(' ') || ''}`);
                }
                if (config.url) {
                    console.log(`   🌍 URL: ${config.url}`);
                }
            }
            console.log('');
        });
        console.log('-'.repeat(40));
    }

    private clearHistory(): void {
        this.shared.messages = [];
        console.log('🧹 Conversation history cleared!');
    }

    private async processUserInput(input: string): Promise<boolean> {
        const trimmedInput = input.trim();
        const lowerInput = trimmedInput.toLowerCase();

        // Handle special commands
        if (['exit', 'quit', 'bye'].includes(lowerInput)) {
            console.log('\n👋 Thanks for trying the MCP demo! Goodbye!');
            return false; // Exit demo
        }

        if (lowerInput === 'history') {
            this.showHistory();
            return true; // Continue demo
        }

        if (lowerInput === 'clear') {
            this.clearHistory();
            return true; // Continue demo
        }

        if (lowerInput === 'tools') {
            this.showTools();
            return true; // Continue demo
        }

        if (lowerInput === 'servers') {
            this.showServers();
            return true; // Continue demo
        }

        if (trimmedInput === '') {
            console.log('💭 Please enter a message or type "help" for available commands.');
            return true; // Continue demo
        }

        if (lowerInput === 'help') {
            console.log('\n📚 Available Commands:');
            console.log('   • exit, quit, bye - End the demo');
            console.log('   • history - Show conversation history');
            console.log('   • clear - Clear conversation history');
            console.log('   • tools - Show available MCP tools');
            console.log('   • servers - Show connected MCP servers');
            console.log('   • help - Show this help message');
            console.log('\nOr just type any message to chat with the AI! 💬');
            return true;
        }

        try {
            // Show thinking indicator
            process.stdout.write('🤖 AI is analyzing your request');
            const thinkingInterval = setInterval(() => {
                process.stdout.write('.');
            }, 500);

            // Send message to MCP-enabled AI
            const response = await sendMCPMessage(
                this.shared, 
                trimmedInput,
                this.mcpManager,
                this.serverConfigs
            );
            
            // Clear thinking indicator
            clearInterval(thinkingInterval);
            process.stdout.write('\r' + ' '.repeat(40) + '\r'); // Clear the thinking line

            // Display the latest exchange
            const userMessage = this.shared.messages[this.shared.messages.length - 2];
            const aiMessage = this.shared.messages[this.shared.messages.length - 1];

            console.log(this.formatMessage(userMessage.role, userMessage.content));
            
            // Show tool usage if any
            if (aiMessage.toolCalls && aiMessage.toolCalls.length > 0) {
                aiMessage.toolCalls.forEach(call => {
                    console.log(`   🔧 Used tool: \x1b[33m${call.toolName}\x1b[0m`);
                });
            }
            
            console.log(this.formatMessage(aiMessage.role, aiMessage.content));
            console.log(); // Empty line for spacing

        } catch (error) {
            console.error('\n❌ Error communicating with AI:', error instanceof Error ? error.message : 'Unknown error');
            console.log('🔄 Please try again or check your configuration.\n');
            
            // Show troubleshooting tips
            console.log('💡 Troubleshooting tips:');
            console.log('   1. Make sure your OpenAI API key is set in .env file');
            console.log('   2. Ensure MCP servers are installed: npm run install-mcp-servers');
            console.log('   3. Check that you\'re in the right directory\n');
        }

        return true; // Continue demo
    }

    public async start(): Promise<void> {
        this.showWelcome();

        return new Promise((resolve) => {
            const askQuestion = () => {
                this.rl.question('\n💬 You: ', async (input) => {
                    const shouldContinue = await this.processUserInput(input);
                    
                    if (shouldContinue) {
                        askQuestion(); // Continue the conversation
                    } else {
                        // Clean up before exiting
                        try {
                            await this.mcpManager.disconnect();
                        } catch (error) {
                            console.warn('Warning: Error disconnecting from MCP servers:', error);
                        }
                        
                        this.rl.close();
                        resolve();
                    }
                });
            };

            askQuestion();
        });
    }
}

// Main function to start the demo
async function main() {
    console.log('🔧 Initializing MCP Terminal Demo...');
    
    // Check for required environment variables
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Error: OPENAI_API_KEY environment variable is required');
        console.log('💡 Please create a .env file with your OpenAI API key:');
        console.log('   OPENAI_API_KEY=your-api-key-here');
        process.exit(1);
    }

    const demo = new MCPTerminalDemo();
    await demo.start();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\n\n👋 Demo interrupted. Cleaning up...');
    process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught error:', error);
    console.log('The demo will now exit. Please check your configuration and try again.');
    process.exit(1);
});

// Start the demo
main().catch((error) => {
    console.error('❌ Failed to start MCP demo:', error);
    console.log('\n💡 Quick setup checklist:');
    console.log('   1. Install dependencies: npm install');
    console.log('   2. Install MCP servers: npm run install-mcp-servers');
    console.log('   3. Set up .env file with OPENAI_API_KEY');
    console.log('   4. Run: npm run demo');
    process.exit(1);
});
