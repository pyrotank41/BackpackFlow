# Article Writing Workflow

A PocketFlow TypeScript example that demonstrates an article writing workflow using a sequence of LLM calls to create engaging content.

## Features

- **Sequential Workflow**: Three connected nodes that build upon each other
- **Structured Output**: Generate YAML outline with up to 3 main sections
- **Content Generation**: Write concise (100 words max) content for each section
- **Style Application**: Transform content into conversational, engaging style
- **Type Safety**: Full TypeScript implementation with proper interfaces

## Quick Setup & Run

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Set your OpenAI API key:**
    ```bash
    export OPENAI_API_KEY="your-api-key-here"
    ```
    
    Or create a `.env` file:
    ```bash
    echo "OPENAI_API_KEY=your-api-key-here" > .env
    ```

3. **Run with default topic ("AI Safety"):**
    ```bash
    npm start
    ```

4. **Or specify your own topic:**
    ```bash
    npm start "Climate Change"
    npm start "Space Exploration"
    npm start "Quantum Computing"
    ```

## How It Works

The workflow demonstrates PocketFlow's sequential node chaining with three connected nodes:

```mermaid
graph LR
    Outline[OutlineNode] --> Write[ContentNode]
    Write --> Style[StyleNode]
    Style --> Complete[End]
```

### Workflow Steps:

1. **📋 OutlineNode**: Creates a simple outline with up to 3 main sections using YAML structured output
2. **✍️ ContentNode**: Writes concise 100-word explanations for each section in simple terms  
3. **🎨 StyleNode**: Rewrites the combined content in a conversational, engaging style

Each node follows the PocketFlow pattern (prep → exec → post) and passes data to the next node through shared state.

## What You'll See

Example output for "AI Safety" topic:

```
🚀 Article Writing Workflow - PocketFlow
========================================
Topic: AI Safety

📋 Generating outline...
✨ Outline created with 3 sections

✍️ Writing content for each section...
📝 Section 1: Introduction to AI Safety (98 words)
📝 Section 2: Key Challenges in AI Safety (95 words)  
📝 Section 3: Strategies for Ensuring AI Safety (99 words)
✨ Content generation complete

🎨 Applying conversational style...
✨ Style transformation complete

📄 Final Article:
=================

# Welcome to the World of AI Safety

Have you ever wondered what it would be like to have your very own robot helping you around the house? Sounds like a dream, right? But let's hit pause for a moment...

[... full styled article content ...]

===================
✅ Workflow Complete!

📊 Stats:
- Outline: 3 sections
- Draft: 1,647 characters
- Final Article: 2,234 characters
```

## Key Learning Points

1. **Sequential Node Chaining**: See how PocketFlow nodes pass data between each other
2. **Structured Output**: Learn to extract YAML/JSON from LLM responses
3. **Multi-step Processing**: Understand how complex workflows break down into simple steps
4. **State Management**: See how shared state carries data through the entire workflow
5. **Content Transformation**: Observe how the same content can be restyled for different audiences

## API Usage

Use the workflow in your own code:

```typescript
import { runArticleWorkflow } from './main';

const article = await runArticleWorkflow("Your topic here");
console.log(article.finalContent);
```

## Customization

### Modify the Outline Structure

Edit the `OutlineSchema` to change the outline format:

```typescript
// In main.ts - Change the schema definition
const OutlineSchema = z.object({
  sections: z.array(z.string().describe("Section title"))
    .max(5) // Change from 3 to 5 sections
    .describe("List of up to 5 main article sections")
});
```

### Adjust Content Length

Modify the `SectionContentSchema` and update prompts accordingly:

```typescript
// In main.ts - Update the schema to expect longer content
const SectionContentSchema = z.object({
  title: z.string().describe("Section title"),
  content: z.string().describe("Section content (around 200 words)"), // Changed from 100
  word_count: z.number().describe("Actual word count of the content")
});

// Then update the ContentNode prompt
const prompt = `Write approximately 200 words...`; // Instead of 100 words
```

### Customize the Writing Style

Modify the `ArticleSchema` and prompts in `StyleNode`:

```typescript
// In main.ts - Update the schema description
const ArticleSchema = z.object({
  title: z.string().describe("Professional article title"),
  content: z.string().describe("Full article content in academic, professional tone"), // Changed
  word_count: z.number().describe("Total word count of the article")
});

// Then update the StyleNode prompt
const prompt = `Rewrite in an academic, professional tone...`; // Instead of conversational
```

## Files

- [`main.ts`](./main.ts): Complete workflow implementation - All nodes, flow setup, and execution logic
- [`utils.ts`](./utils.ts): Shared utilities - Instructor client setup and configuration
- [`package.json`](./package.json): Node.js package configuration  
- [`tsconfig.json`](./tsconfig.json): TypeScript compilation settings

## Advanced Usage

### Batch Processing Multiple Topics

```typescript
const topics = ["AI Safety", "Climate Change", "Space Exploration"];
for (const topic of topics) {
  const article = await runArticleWorkflow(topic);
  console.log(`Article for ${topic}:`, article.finalContent);
}
```

### Save Articles to Files

```typescript
import fs from 'fs';

const article = await runArticleWorkflow("Your Topic");
fs.writeFileSync(`article-${Date.now()}.md`, article.finalContent);
```

This workflow demonstrates the power of PocketFlow for creating complex, multi-step content generation pipelines with proper TypeScript typing and error handling.
