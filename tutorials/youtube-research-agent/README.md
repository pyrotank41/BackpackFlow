# YouTube Research Agent Tutorial

**Find outlier YouTube videos and understand why they're performing well.**

This tutorial demonstrates building a REAL agent with BackpackFlow v2.0 that you'll actually use!

---

## What It Does

1. **Searches YouTube** for your query (e.g., "AI productivity tools")
2. **Finds outliers** - videos performing 10x+ above median
3. **Explains why** they're successful using AI analysis

**Perfect for:**
- Content creators looking for trends
- Marketers researching competition
- Anyone wanting to understand what makes videos go viral

---

## Architecture

```
User Query: "AI productivity tools"
   ↓
YouTubeSearchNode
   - Search YouTube Data API
   - Fetch 50 recent videos
   - Pack: searchResults
   ↓
DataAnalysisNode
   - Calculate statistics (mean, median)
   - Find 10x outliers
   - Pack: outliers, statistics
   ↓
BaseChatCompletionNode
   - Analyze outliers with GPT-4
   - Generate insights
   - Pack: summary
   ↓
Display Results
```

**Demonstrates BackpackFlow v2.0:**
- ✅ Multi-node workflows
- ✅ Backpack state management
- ✅ Event streaming (observability)
- ✅ Real-time logging
- ✅ Error handling

---

## Setup

### 1. Get API Keys

**YouTube Data API v3:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. (Optional) Restrict key to YouTube Data API v3

**Free Tier:** 10,000 quota/day (enough for ~200 searches)

**OpenAI API:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create API key

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# YouTube Data API v3
YOUTUBE_API_KEY=your_youtube_api_key_here

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Install Dependencies

```bash
npm install
```

---

## Usage

### Run the Agent

```bash
# Using npm script
npm run tutorial:youtube-agent "AI productivity tools"

# Or directly with ts-node
ts-node tutorials/youtube-research-agent/youtube-research-agent.ts "your query here"
```

### Example Queries

```bash
npm run tutorial:youtube-agent "AI coding assistants"
npm run tutorial:youtube-agent "productivity apps"
npm run tutorial:youtube-agent "AI art generation"
npm run tutorial:youtube-agent "fitness motivation"
```

---

## Example Output

```
================================================================================
🔍 YouTube Research Agent
================================================================================
Query: "AI productivity tools"

[0.00s] 🚀 Starting YouTubeSearchNode...
[0.00s] 💾 Packed 'searchQuery'
[2.34s] ⚡ YouTubeSearchNode complete (2340ms)
[2.34s] 💾 Packed 'searchResults'
[2.34s] ✅ YouTubeSearchNode → complete

[2.35s] 🚀 Starting DataAnalysisNode...
[2.38s] ⚡ DataAnalysisNode complete (30ms)
[2.38s] 💾 Packed 'outliers'
[2.38s] 💾 Packed 'statistics'
[2.38s] ✅ DataAnalysisNode → complete

[2.39s] 🚀 Starting BaseChatCompletionNode...
[5.67s] ⚡ BaseChatCompletionNode complete (3280ms)
[5.67s] 💾 Packed 'chatResponse'
[5.67s] ✅ BaseChatCompletionNode → complete

================================================================================
📊 RESULTS
================================================================================

📺 Search Results: 50 videos found
🔎 Query: "AI productivity tools"

📈 Statistics:
   Mean views: 45.2K
   Median views: 12.3K
   Range: 1.2K - 2.1M

💡 Analysis Insights:
   • Analyzed 50 items with metric: views
   • Mean: 45.2K, Median: 12.3K
   • Range: 1.2K to 2.1M
   • Found 5 outliers (10.0%) performing 10x+ above median
   • Outlier threshold: 123.0K

🌟 Top 5 Outlier Videos:

1. I Tested 47 AI Tools - These Are The Best
   Channel: Productivity Guy
   Views: 2.1M
   Likes: 98K
   URL: https://www.youtube.com/watch?v=...

2. How I Use AI To Automate Everything
   Channel: Tech Creator
   Views: 1.5M
   Likes: 76K
   URL: https://www.youtube.com/watch?v=...

3. AI Productivity Stack 2024
   Channel: Silicon Valley Insider
   Views: 890K
   Likes: 45K
   URL: https://www.youtube.com/watch?v=...

🤖 AI Analysis:

These outlier videos share several success patterns:

1. Comprehensive Testing: The top video tested 47 tools, providing 
   massive value through aggregation and curation.

2. Practical Demonstrations: All showed real workflows, not just 
   theoretical benefits.

3. Timely Trends: Published within trending AI adoption wave.

4. Clear Value Propositions: Titles promise specific outcomes.

5. Strong Thumbnails: Professional, high-contrast designs that 
   stand out in feeds.

================================================================================
📊 Observability Stats:
   Total Events: 27
   Nodes Executed: 3
   Namespaces: 3
================================================================================
```

---

## Code Structure

```
tutorials/youtube-research-agent/
├── youtube-research-agent.ts      # Main agent
├── base-chat-completion-node.ts   # Reusable LLM wrapper
├── youtube-search-node.ts         # YouTube API integration
├── data-analysis-node.ts          # Statistical analysis
└── README.md                      # This file
```

---

## Key Features Demonstrated

### 1. Backpack State Management

```typescript
// Pack data
backpack.pack('searchQuery', query);

// Unpack data
const results = backpack.unpack('searchResults');

// Get with metadata
const item = backpack.getItem('searchResults');
console.log(item.metadata.sourceNode); // "YouTubeSearchNode"
```

### 2. Event Streaming

```typescript
// Subscribe to all events
streamer.on('*', (event) => {
    console.log(`${event.type} from ${event.sourceNode}`);
});

// Get statistics
const stats = streamer.getStats();
```

### 3. Node Composition

```typescript
// Create reusable nodes
const searchNode = flow.addNode(YouTubeSearchNode, { id: 'search' });
const analysisNode = flow.addNode(DataAnalysisNode, { id: 'analysis' });

// Connect them
searchNode.on('complete', analysisNode);
```

### 4. Error Handling

```typescript
// Handle different outcomes
searchNode.on('no_results', () => {
    console.log('No results found');
});

analysisNode.on('no_outliers', () => {
    console.log('No outliers detected');
});
```

---

## Extending the Agent

### Add More Analysis

```typescript
// Find videos with high engagement
const engagementNode = flow.addNode(DataAnalysisNode, {
    id: 'engagement',
    metric: 'likes',
    threshold: 5
});

analysisNode.on('complete', engagementNode);
```

### Add Web Search

```typescript
// Search web for related content
const webSearchNode = flow.addNode(WebSearchNode, {
    id: 'web-search'
});

summaryNode.on('complete', webSearchNode);
```

### Save Results

```typescript
// Save to database
const saveNode = flow.addNode(DatabaseSaveNode, {
    id: 'save',
    connectionString: process.env.DATABASE_URL
});

summaryNode.on('complete', saveNode);
```

---

## Troubleshooting

### "YouTube API key is required"
- Make sure `.env` file exists in project root
- Verify `YOUTUBE_API_KEY` is set correctly

### "Quota exceeded"
- YouTube API has 10,000 quota/day
- Each search uses ~100 quota
- Wait 24 hours or create a new API key

### "No outliers found"
- Try a more popular topic
- Lower the threshold (e.g., `threshold: 5`)
- Increase `maxResults` in search node

### API Errors
- Check your API keys are valid
- Verify YouTube API v3 is enabled
- Check your internet connection

---

## What's Next?

This agent validates BackpackFlow v2.0's API through real-world use!

**Next steps:**
1. Try it with your own queries
2. Modify the nodes to fit your needs
3. Build your own agents!
4. Share what you built!

**Coming in Day 3:**
- BackpackFlow Studio (visual debugging UI)
- See your agent running in real-time
- Time-travel debugging

---

## License

Apache License 2.0

---

## Questions?

Open an issue on GitHub: https://github.com/pyrotank41/Backpackflow/issues

---

**Built with ❤️ to validate BackpackFlow v2.0**

