# Troubleshooting Guide 🔧

*Part 1: Foundation - Common Issues & Solutions*

> 🧠 **Debugging is First Principles Thinking**: Break complex problems into simple pieces, test each piece, fix what's broken. That's exactly how we built our AI components!

## 🚨 API Key Issues

### Issue: "OpenAI API key not found"
**Symptoms**: Error message mentioning missing API key
**Solution**: 
```bash
# Create a .env file in the examples directory
echo "OPENAI_API_KEY=your-key-here" > examples/.env
```
**Prevention**: Always set up environment variables before running examples

### Issue: "Invalid API key"
**Symptoms**: 401 authentication error
**Solution**: 
1. Get a valid key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Check that your key starts with `sk-`
3. Verify there are no extra spaces in your .env file
**Prevention**: Test your API key with a simple curl request first

### Issue: "OpenAI quota exceeded"
**Symptoms**: Billing or quota error messages
**Solution**: 
1. Check your OpenAI billing dashboard
2. Add payment method if needed
3. Consider using a different model (gpt-3.5-turbo is cheaper)
**Prevention**: Monitor your usage and set billing alerts

## 🔄 Runtime Errors

### Issue: "Cannot find module" errors
**Symptoms**: Module not found when running `npx tsx`
**Solution**:
```bash
# Make sure you're in the right directory
cd examples/building-ai-from-first-principles/01-foundations

# Install dependencies if needed
npm install

# Try running with full path
npx tsx ./examples/basic-chat.ts
```
**Prevention**: Always run commands from the correct directory

### Issue: Empty or undefined responses
**Symptoms**: AI returns nothing or undefined content
**Solution**:
1. Check your internet connection
2. Try a different model (gpt-4o-mini, gpt-3.5-turbo)
3. Enable debug mode: `DEBUG_CHAT=true npx tsx examples/basic-chat.ts`
**Prevention**: Always validate API responses in production code

### Issue: TypeScript compilation errors
**Symptoms**: Type errors when running examples
**Solution**:
```bash
# Check TypeScript version
npx tsc --version

# If using older TypeScript, update
npm install -g typescript@latest

# Try running with tsx directly
npx tsx --version
```
**Prevention**: Use the latest stable TypeScript version

## 🧠 Conceptual Confusion

### Issue: "I don't understand what SharedStorage does"
**Symptoms**: Confusion about the storage pattern
**Solution**: 
- Think of SharedStorage as the "memory" of your AI system
- It's like a notebook that gets passed between phases
- Each phase can read from and write to this notebook
- Try the debug mode to see how it changes: `DEBUG_CHAT=true npx tsx examples/basic-chat.ts`

### Issue: "Why separate prep/exec/post?"
**Symptoms**: Wondering why not just one function
**Solution**: 
- **Testability**: You can test each phase independently
- **Debugging**: Know exactly where issues occur
- **Reusability**: Mix and match phases for different use cases
- **Clarity**: Each phase has a single responsibility

### Issue: "The ETL analogy doesn't make sense"
**Symptoms**: Confusion about Extract/Transform/Load comparison
**Solution**:
- **Extract** (prep): Get data from SharedStorage
- **Transform** (exec): Process the data (call LLM)
- **Load** (post): Put results back into SharedStorage
- If you're not from data engineering, think **Input→Process→Output**

## 🔧 Development Issues

### Issue: Code changes not taking effect
**Symptoms**: Modifications don't seem to work
**Solution**:
1. Save your files (Ctrl+S / Cmd+S)
2. Check you're editing the right file
3. Make sure no syntax errors (check your editor)
4. Try restarting your terminal
**Prevention**: Use an editor with auto-save and error highlighting

### Issue: Console output is messy
**Symptoms**: Hard to read output, mixed up logs
**Solution**:
```bash
# Run examples one at a time
npx tsx examples/basic-chat.ts

# Use debug mode for step-by-step output
DEBUG_CHAT=true npx tsx examples/basic-chat.ts

# Clear terminal between runs
clear && npx tsx examples/basic-chat.ts
```
**Prevention**: Run examples individually, not in parallel

### Issue: "My modifications break everything"
**Symptoms**: Simple changes cause errors
**Solution**:
1. Start with the original working example
2. Make one small change at a time
3. Test after each change
4. Use version control (git) to track changes
**Prevention**: Copy the original file before modifying

## 🎯 Learning Challenges

### Issue: "This seems too complex for a beginner"
**Symptoms**: Feeling overwhelmed by the patterns
**Solution**:
- Start with just running the examples as-is
- Don't worry about understanding everything immediately
- Focus on one concept at a time (start with SharedStorage)
- Try the interactive chat to see the pattern in action
**Tip**: It's okay to copy-paste first, understand later!

### Issue: "I don't see the benefit of this pattern"
**Symptoms**: Thinking traditional approaches are simpler
**Solution**:
- Try building a feature without the pattern first
- Then try adding error handling, testing, or new features
- You'll quickly see where the pattern helps
- Check out `examples/interactive-chat.ts` to see the same ChatNode handling complex interactions

### Issue: "How do I apply this to my project?"
**Symptoms**: Unsure how to use PocketFlow for real work
**Solution**:
1. Start by identifying your current "mixed concerns" code
2. Break it into prep (get data), exec (do work), post (handle results)
3. Move one piece at a time to the pattern
4. Test each piece independently
**Next Steps**: Continue to Part 2 to see more complex applications

## 🆘 Getting Help

### When to Ask for Help
- You've tried the solutions above
- Error messages don't match anything here
- You want to understand deeper concepts
- You're stuck on the learning concepts

### Where to Get Help
- **🎓 See JOIN_COMMUNITY.md** - Your first stop for personalized help
- GitHub Issues (for bugs in examples)
- GitHub Discussions (for learning questions)
- Stack Overflow (tag with `pocketflow` or `backpackflow`)

> 🤝 **Community First**: The best help comes from fellow builders who've faced the same challenges. See [JOIN_COMMUNITY.md](../JOIN_COMMUNITY.md) and pay it forward!

### How to Ask Good Questions
1. **Include error messages** - copy the full error
2. **Show your code** - what you tried to modify
3. **Describe expected vs actual** - what you wanted vs what happened
4. **Include environment info** - OS, Node version, etc.

## 🔍 Debug Mode Guide

Enable debug mode to see exactly what's happening:

```bash
# See step-by-step execution
DEBUG_CHAT=true npx tsx examples/basic-chat.ts

# You'll see output like:
🔍 PREP: Adding user message to conversation
🔍 PREP: Conversation now has 1 messages
🔍 EXEC: Calling LLM with messages: 1
🔍 EXEC: Got response from LLM
🔍 POST: Storing AI response in SharedStorage
🔍 POST: Conversation now has 2 messages
```

This helps you understand:
- When each phase runs
- What data flows between phases
- Where errors occur
- How SharedStorage changes

---

**Still stuck?** Remember: the goal is learning, not perfection. It's okay to not understand everything immediately. Focus on getting the examples running first, then dive deeper into the concepts.

**Ready to continue?** Once you've got the basic example working, try the interactive chat in `examples/interactive-chat.ts` to see the same pattern handling real conversations!
