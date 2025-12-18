# Building Your First AI Chatbot with PocketFlow 🤖

*Part 1: From Zero to Chatbot - Understanding the Building Blocks*

Welcome to the first part of our series exploring how far we can push PocketFlow in building complex AI agents! In this tutorial, we'll start simple and build a working chatbot that can hold conversations with users. By the end, you'll understand the core concepts of PocketFlow and have a solid foundation for building more sophisticated agents.

## What We're Building 🎯

We're going to create two things:
1. A **simple chatbot** that responds to a single message
2. An **interactive terminal chat** for ongoing conversations

Both will use the same underlying PocketFlow architecture, showing you how to build reusable, modular AI components.

## Prerequisites 📋

- Node.js installed on your machine
- An OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- Basic TypeScript knowledge (don't worry, we'll explain everything!)

## The Big Picture: Understanding PocketFlow 🌟

Before we dive into code, let's understand what makes PocketFlow special. Traditional chatbot frameworks often force you into rigid patterns. PocketFlow is different—it's built around three core concepts:

1. **Nodes** - Individual processing units that do one thing well
2. **Flows** - Orchestrators that connect nodes together
3. **Shared Storage** - A way for nodes to communicate and maintain state

Think of it like building with LEGO blocks, but for AI workflows!

## Step 1: Setting Up Your Environment 🏗️

First, let's get our project ready:

```bash
# Install dependencies
npm install dotenv openai @types/node readline

# Create your environment file
echo "OPENAI_API_KEY=your-api-key-here" > .env
```

> ⚠️ **Important**: Replace `your-api-key-here` with your actual OpenAI API key!

## Step 2: Understanding the Architecture 🏛️

Let's break down what we're building:

```
User Input → ChatNode → OpenAI API → Response → Shared Storage
```

Here's what each piece does:

- **User Input**: The message from the user
- **ChatNode**: Our PocketFlow node that processes the conversation
- **OpenAI API**: The AI service that generates responses
- **Shared Storage**: Where we keep the conversation history

## Step 3: Building the Core Components 🔧

### Defining Our Data Types

First, we need to define what our data looks like:

```typescript
// What a single message looks like
type Message = {
    role: 'user' | 'assistant';  // Who sent it?
    content: string;             // What did they say?
}

// Our conversation storage
type SharedStorage = {
    messages: Message[];         // Array of all messages
}
```

### Creating the LLM Helper Function

This function talks to OpenAI for us:

```typescript
async function callLLM(messages: Message[]): Promise<string> {
    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY'],
    });

    const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
    });
    
    return completion.choices[0].message.content ?? '';
}
```

**What's happening here?**
- We create an OpenAI client with our API key
- We send all our conversation messages to GPT-4
- We return the AI's response as a string

### Building Our ChatNode 🤖

This is where PocketFlow magic happens! A Node has three lifecycle methods:

```typescript
class ChatNode extends Node<SharedStorage> {
    constructor(private userMessage: string) {
        super();
    }

    // 1. PREP: Prepare data for processing
    async prep(shared: SharedStorage): Promise<Message[]> {
        // Add the user's message to our conversation
        shared.messages.push({ role: 'user', content: this.userMessage });
        return shared.messages;  // Pass conversation to exec()
    }
    
    // 2. EXEC: Do the main work (call the AI)
    async exec(messages: Message[]): Promise<string> {
        const response = await callLLM(messages);
        return response;  // Pass AI response to post()
    }
    
    // 3. POST: Clean up and store results
    async post(shared: SharedStorage, prepRes: unknown, execRes: unknown): Promise<string | undefined> {
        // Add AI response back to conversation
        shared.messages.push({ 
            role: 'assistant', 
            content: execRes as string 
        });
        return undefined; // End the flow
    }
}
```

**The PocketFlow Lifecycle Explained:**

1. **`prep()`** - Gets data ready. We add the user message and return the full conversation.
2. **`exec()`** - Does the heavy lifting. We call OpenAI with all messages.
3. **`post()`** - Handles results. We store the AI's response in our shared storage.

This separation makes testing, debugging, and extending much easier!

### Creating the Flow Orchestrator 🎭

A Flow connects nodes together:

```typescript
class ChatFlow extends Flow<SharedStorage> {
    constructor(userMessage: string) {
        const chatNode = new ChatNode(userMessage);
        super(chatNode);  // Start the flow with our ChatNode
    }
}
```

For our simple chatbot, we only need one node. But this pattern scales beautifully—imagine chaining nodes for translation, sentiment analysis, or content moderation!

## Step 4: Putting It All Together 🎪

Here's our complete simple chatbot:

```typescript
async function main() {
    // Create empty conversation
    const shared: SharedStorage = { messages: [] };
    
    // Send a message through our flow
    await sendMessage(shared, "Hello, how are you?");
    
    // Display the conversation
    console.log('Conversation:');
    shared.messages.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.role}: ${msg.content}`);
    });
}

main();
```

## Step 5: Running Your Chatbot 🚀

```bash
npx ts-node simple-chatbot.ts
```

You should see output like:

```
Conversation:
1. user: Hello, how are you?
2. assistant: Hello! I'm doing well, thank you for asking. How can I help you today?
```

## Step 6: Taking It Further - Interactive Chat 💬

Want to have real conversations? We've also built an interactive terminal version:

```bash
npx ts-node terminal-chat.ts
```

This gives you:
- ✨ Real-time conversations
- 🎨 Colored output
- 📜 Conversation history
- 🧹 Clear commands
- 🔚 Easy exit options

## Why PocketFlow Rocks for AI Development 🌟

**Traditional Approach:**
```typescript
// Monolithic, hard to test, hard to extend
async function chatbot(message: string) {
    // Everything mixed together
    const conversation = [];
    conversation.push({role: 'user', content: message});
    const response = await openai.complete(conversation);
    conversation.push({role: 'assistant', content: response});
    return conversation;
}
```

**PocketFlow Approach:**
```typescript
// Modular, testable, extensible
class ChatNode extends Node<SharedStorage> {
    async prep() { /* Add user message */ }
    async exec() { /* Call AI */ }
    async post() { /* Store response */ }
}
```

**Benefits:**
- 🧪 **Easy Testing**: Test each phase independently
- 🔧 **Easy Debugging**: Know exactly where things go wrong
- 🚀 **Easy Extending**: Add new nodes for new features
- 🔄 **Easy Reusing**: Use the same node in different flows

## What's Next? 🛣️

This is just the beginning! In upcoming parts of this series, we'll explore:

- **Part 2**: Building multi-step agents with chained nodes
- **Part 3**: Adding memory and context management
- **Part 4**: Creating specialized agent roles
- **Part 5**: Building complex workflows with branching logic

## Key Takeaways 💡

1. **PocketFlow separates concerns** - prep, exec, and post phases make code cleaner
2. **Shared storage enables communication** - nodes can share data seamlessly
3. **Flows orchestrate complexity** - start simple, scale as needed
4. **Modularity wins** - reusable components save time and reduce bugs

## Troubleshooting 🔧

**Common Issues:**

1. **"OpenAI API key missing"** - Make sure your `.env` file is in the right directory
2. **"Cannot find module"** - Run `npm install` to install dependencies
3. **TypeScript errors** - Make sure you have `@types/node` installed

## Files in This Example 📁

- `simple-chatbot.ts` - Basic one-shot chatbot
- `terminal-chat.ts` - Interactive terminal interface
- `chatbot-core.ts` - Reusable components
- `.env` - Your API key (create this!)

## Ready to Build Something Amazing? 🚀

You now have the foundational knowledge to build AI agents with PocketFlow! The simple chatbot we built demonstrates the core concepts you'll use in much more complex scenarios.

Try experimenting with:
- Different OpenAI models (gpt-3.5-turbo, gpt-4, etc.)
- Custom system prompts
- Conversation memory limits
- Error handling improvements

Happy building! 🎉

---

*Next up: Part 2 - Building Multi-Step AI Agents - Where we'll chain multiple nodes together to create more sophisticated behaviors.*

---

## Run Commands 🏃‍♂️

```bash
# Simple one-shot chatbot
npx ts-node simple-chatbot.ts

# Interactive terminal chat
npx ts-node terminal-chat.ts
```

Remember to set your OpenAI API key in the `.env` file first!
