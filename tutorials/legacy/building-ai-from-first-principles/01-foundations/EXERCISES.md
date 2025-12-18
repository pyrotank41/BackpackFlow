# Hands-On Exercises 🎯

*Part 1: Foundation - Practice What You've Learned*

## 🤔 Understanding Checks

After running the examples, test your comprehension:

> 🧠 **Manifesto Check**: Can you see how we turned *one complex function* into *three simple ideas*? That's first principles thinking in action!

### Basic Understanding
1. **What happens if you remove the `post()` method?** Try it and see!
2. **How would you add a conversation limit?** (Hint: check `shared.messages.length`)
3. **What if you wanted to save conversations to a file?**

### Pattern Recognition
1. **Identify the three phases** in your own words:
   - prep() does: ________________
   - exec() does: ________________  
   - post() does: ________________

2. **Why is exec() isolated?** What's the benefit of not giving it access to SharedStorage?

3. **Give three examples** of other tasks that could follow this pattern (hint: think beyond AI)

## 💡 Try This: Beginner Modifications

### Exercise 1: Add Message Timestamps
**Goal**: Add timestamps to every message in the conversation

**Starting Point**: Copy `examples/basic-chat.ts` to `examples/chat-with-timestamps.ts`

**Your Task**: 
```typescript
// Modify the Message type to include timestamp
type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: Date; // Add this
}

// Update prep() and post() to add timestamps
// Display timestamps in the final output
```

**Expected Output**:
```
1. 👤 user (2023-12-01 10:30:15): Hello!
2. 🤖 assistant (2023-12-01 10:30:17): Hi there!
```

**Hint**: Use `new Date()` to get current timestamp

### Exercise 2: Conversation Length Limit
**Goal**: Prevent conversations from getting too long (max 10 messages)

**Your Task**:
```typescript
// In prep(), check if conversation is too long
// If so, remove the oldest messages (except system messages)
// Keep the conversation under 10 total messages
```

**Test It**: Try sending 15 messages and verify only the latest 10 are kept

### Exercise 3: System Message Support
**Goal**: Add a system message that sets the AI's personality

**Your Task**:
```typescript
// Add systemMessage to SharedStorage type
// In prep(), always ensure the first message is the system message
// Don't let the system message get removed by length limits
```

**Test It**: Set a system message like "You are a helpful pirate" and verify the AI responds in character

## 🔥 Challenge: Intermediate Modifications

### Challenge 1: Multiple AI Personalities
**Goal**: Create a ChatNode that can switch between different AI personalities

**Requirements**:
- Support multiple system messages (professional, casual, creative)
- Allow switching personality mid-conversation
- Store the current personality in SharedStorage

**Advanced**: Create separate ChatNode classes for each personality

> 🏗️ **Building Blocks in Action**: Each personality is just another *simple idea* - a different system message! Stack them together for multi-personality agents.

### Challenge 2: Conversation Persistence  
**Goal**: Save and load conversations from files

**Requirements**:
- Save conversation to JSON file after each message
- Load existing conversation on startup
- Handle file errors gracefully

**File Structure**:
```json
{
  "id": "conversation-123",
  "created": "2023-12-01T10:30:00Z",
  "messages": [...],
  "metadata": {
    "model": "gpt-4o",
    "personality": "helpful"
  }
}
```

### Challenge 3: Cost Tracking
**Goal**: Track and display the cost of each conversation

**Requirements**:
- Calculate tokens used (approximate: ~4 chars = 1 token)
- Apply OpenAI pricing (input vs output tokens)
- Display running cost total
- Warn when approaching a budget limit

## 🧠 Conceptual Exercises

### Exercise 1: Apply the Pattern Elsewhere
**Think of 3 non-AI examples** that could use prep→exec→post:

1. **Web API Handler**:
   - prep(): ________________
   - exec(): ________________
   - post(): ________________

2. **Data Processing Pipeline**:
   - prep(): ________________
   - exec(): ________________
   - post(): ________________

3. **Your Own Example**:
   - prep(): ________________
   - exec(): ________________
   - post(): ________________

### Exercise 2: Debug a Broken Example
Here's broken code - find and fix the issues:

```typescript
class BrokenChatNode extends Node<SharedStorage> {
    async prep(shared: SharedStorage): Promise<void> {
        shared.messages.push({ role: 'user', content: this.userMessage });
        // Issue 1: What should this return?
    }
    
    async exec(data: any): Promise<string> {
        // Issue 2: What if data is undefined?
        const response = await callLLM(data);
        return response;
    }
    
    async post(shared: SharedStorage, prepRes: any, execRes: any): Promise<string> {
        shared.messages.push({ role: 'assistant', content: execRes });
        return execRes; // Issue 3: What should this return for a final node?
    }
}
```

**Your Analysis**:
- Issue 1: ________________
- Issue 2: ________________  
- Issue 3: ________________

### Exercise 3: Design a Node
**Design a "TranslateNode"** that translates user messages to another language:

```typescript
type TranslateStorage = {
    messages: Message[];
    targetLanguage: string;
    originalMessage: string;
}

class TranslateNode extends Node<TranslateStorage> {
    // Your implementation here
    async prep(shared: TranslateStorage): Promise<???> {
        // What data does the translator need?
    }
    
    async exec(???): Promise<???> {
        // How do you call the translation API?
    }
    
    async post(shared: TranslateStorage, prepRes: any, execRes: any): Promise<???> {
        // How do you store the translated result?
    }
}
```

## 🎪 Advanced Exploration

### Advanced Challenge 1: Error Recovery
**Goal**: Make your ChatNode resilient to failures

**Requirements**:
- Retry failed LLM calls (up to 3 times)
- Handle rate limiting with exponential backoff
- Provide fallback responses when AI is unavailable
- Log all errors for debugging

### Advanced Challenge 2: Streaming Responses
**Goal**: Show AI responses as they're being generated (like ChatGPT)

**Requirements**:
- Use OpenAI's streaming API
- Update the terminal output in real-time
- Handle streaming errors gracefully
- Keep the prep→exec→post pattern intact

**Hint**: The exec() phase might need to become a generator function

### Advanced Challenge 3: Multi-Model Support
**Goal**: Let users choose different AI models mid-conversation

**Requirements**:
- Support OpenAI, Anthropic, or local models
- Allow switching models during conversation
- Show model info in conversation history
- Handle different model capabilities

## 🏆 Mastery Check

You've mastered Part 1 when you can:

✅ **Explain the benefits** of prep→exec→post to a colleague  
✅ **Build variations** of ChatNode for different use cases  
✅ **Debug issues** by isolating which phase has problems  
✅ **Extend the pattern** with new features like timestamps  
✅ **Apply the pattern** to non-AI problems  
✅ **Help others** who are stuck on the concepts

## 💭 Reflection Questions

1. **What was the biggest "aha!" moment** while working through these exercises?

2. **Which exercise was most challenging?** What made it difficult?

3. **How would you explain the PocketFlow pattern** to someone who's never programmed before?

4. **What other problems** in your work could benefit from this pattern?

5. **What questions do you still have** about the pattern or framework?

## 🚀 Ready for Part 2?

Once you're comfortable with these exercises, you're ready to tackle **Part 2: Research Agent** where you'll:

- Chain multiple nodes together
- Handle complex multi-step workflows  
- Integrate external APIs and tools
- Build your first "intelligent" agent

**Before moving on**, make sure you can:
- Run all the basic examples without errors
- Understand what each phase does and why
- Modify the ChatNode to add simple features
- Explain the pattern to someone else

---

**Remember**: The goal isn't to complete every exercise perfectly. It's to understand the concepts well enough to build on them. Choose the exercises that interest you most, and don't hesitate to modify them to match your learning style!

**Stuck on an exercise?** Check out `TROUBLESHOOTING.md` or see [JOIN_COMMUNITY.md](../JOIN_COMMUNITY.md) - share your attempts and get personalized help!

> 🤝 **Share the Journey**: Post your solutions, failed attempts, and "aha!" moments in the community. Your struggles and breakthroughs help others learn too!
