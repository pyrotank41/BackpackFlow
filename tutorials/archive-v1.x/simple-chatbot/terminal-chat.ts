import * as readline from 'readline';
import { SharedStorage, sendMessage } from './chatbot-core';

class TerminalChat {
    private rl: readline.Interface;
    private shared: SharedStorage;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        this.shared = { messages: [] };
    }

    private formatMessage(role: 'user' | 'assistant', content: string): string {
        const prefix = role === 'user' ? '👤 You' : '🤖 AI';
        const color = role === 'user' ? '\x1b[36m' : '\x1b[32m'; // Cyan for user, Green for AI
        const reset = '\x1b[0m';
        return `${color}${prefix}: ${content}${reset}`;
    }

    private showWelcome(): void {
        console.log('\n🚀 Welcome to PocketFlow Terminal Chat!');
        console.log('💬 Type your messages and press Enter to chat with AI');
        console.log('🔚 Type "exit", "quit", or "bye" to end the conversation');
        console.log('📜 Type "history" to see the full conversation');
        console.log('🧹 Type "clear" to clear the conversation history');
        console.log('-'.repeat(50));
    }

    private showHistory(): void {
        if (this.shared.messages.length === 0) {
            console.log('📭 No conversation history yet. Start chatting!');
            return;
        }

        console.log('\n📜 Conversation History:');
        console.log('-'.repeat(30));
        this.shared.messages.forEach((msg, index) => {
            console.log(`${index + 1}. ${this.formatMessage(msg.role, msg.content)}`);
        });
        console.log('-'.repeat(30));
    }

    private clearHistory(): void {
        this.shared.messages = [];
        console.log('🧹 Conversation history cleared!');
    }

    private async processUserInput(input: string): Promise<boolean> {
        const trimmedInput = input.trim().toLowerCase();

        // Handle special commands
        if (['exit', 'quit', 'bye'].includes(trimmedInput)) {
            console.log('\n👋 Thanks for chatting! Goodbye!');
            return false; // Exit chat
        }

        if (trimmedInput === 'history') {
            this.showHistory();
            return true; // Continue chat
        }

        if (trimmedInput === 'clear') {
            this.clearHistory();
            return true; // Continue chat
        }

        if (trimmedInput === '') {
            console.log('💭 Please enter a message or type "exit" to quit.');
            return true; // Continue chat
        }

        try {
            // Show typing indicator
            process.stdout.write('🤖 AI is thinking');
            const typingInterval = setInterval(() => {
                process.stdout.write('.');
            }, 500);

            // Send message to AI
            const response = await sendMessage(this.shared, input.trim());
            
            // Clear typing indicator
            clearInterval(typingInterval);
            process.stdout.write('\r' + ' '.repeat(20) + '\r'); // Clear the typing line

            // Display the conversation
            const userMessage = this.shared.messages[this.shared.messages.length - 2];
            const aiMessage = this.shared.messages[this.shared.messages.length - 1];

            console.log(this.formatMessage(userMessage.role, userMessage.content));
            console.log(this.formatMessage(aiMessage.role, aiMessage.content));
            console.log(); // Empty line for spacing

        } catch (error) {
            console.error('\n❌ Error communicating with AI:', error instanceof Error ? error.message : 'Unknown error');
            console.log('🔄 Please try again or check your API key.\n');
        }

        return true; // Continue chat
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
                        this.rl.close();
                        resolve();
                    }
                });
            };

            askQuestion();
        });
    }
}

// Main function to start the terminal chat
async function main() {
    const chat = new TerminalChat();
    await chat.start();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Chat interrupted. Goodbye!');
    process.exit(0);
});

// Start the chat
main().catch((error) => {
    console.error('❌ Failed to start chat:', error);
    process.exit(1);
});
