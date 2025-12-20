/**
 * YouTube Research Agent
 * 
 * Find outlier YouTube videos and understand why they're performing well.
 * 
 * Usage:
 *   npm run tutorial:youtube-agent "AI productivity tools"
 */

import { Flow } from '../../src/flows/flow';
import { Backpack } from '../../src/storage/backpack';
import { EventStreamer, StreamEventType } from '../../src/events';
import { BaseChatCompletionNode } from './base-chat-completion-node';
import { YouTubeSearchNode } from './youtube-search-node';
import { DataAnalysisNode } from './data-analysis-node';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * YouTube Research Agent
 * 
 * Architecture:
 *   Search → Analyze → Summarize
 * 
 * Flow:
 *   1. YouTubeSearchNode: Search YouTube for query
 *   2. DataAnalysisNode: Find outlier videos (10x median views)
 *   3. BaseChatCompletionNode: Explain why outliers are successful
 */
class YouTubeResearchAgent {
    private flow: Flow;
    private backpack: Backpack;
    private streamer: EventStreamer;
    
    constructor() {
        // Create event streamer for observability
        this.streamer = new EventStreamer({
            enableHistory: true,
            maxHistorySize: 1000
        });
        
        // Create backpack for state management
        this.backpack = new Backpack(undefined, {
            eventStreamer: this.streamer,
            enableAccessControl: false // Simplified for tutorial
        });
        
        // Create flow
        this.flow = new Flow({
            namespace: 'youtube.research',
            backpack: this.backpack,
            eventStreamer: this.streamer
        });
        
        // Setup nodes
        this.setupNodes();
        
        // Setup event logging
        this.setupEventLogging();
    }
    
    /**
     * Setup the three nodes in our agent
     */
    private setupNodes(): void {
        // 1. YouTube Search Node
        const searchNode = this.flow.addNode(YouTubeSearchNode, {
            id: 'search',
            apiKey: process.env.YOUTUBE_API_KEY || '',
            maxResults: 50
        });
        
        // 2. Data Analysis Node
        const analysisNode = this.flow.addNode(DataAnalysisNode, {
            id: 'analysis',
            metric: 'views',
            threshold: 1.5 // 1.5x channel average = breakthrough video
        });
        
        // 3. Chat Completion Node (for insights)
        const summaryNode = this.flow.addNode(BaseChatCompletionNode, {
            id: 'summary',
            model: 'gpt-4',
            temperature: 0.7,
            systemPrompt: `You are a YouTube analytics expert. Analyze outlier videos and explain why they're successful. Focus on:
- Title strategies
- Timing and trends
- Engagement patterns
- Content uniqueness

Be specific and actionable.`
        });
        
        // Setup flow edges (routing)
        // On success, flow continues through the pipeline
        searchNode.on('complete', analysisNode);
        analysisNode.on('complete', summaryNode);
        
        // For error/terminal actions like 'no_results' and 'no_outliers',
        // we don't register successors - the flow will terminate gracefully
        
        // Set entry node
        this.flow.setEntryNode(searchNode);
    }
    
    /**
     * Setup event logging for observability
     */
    private setupEventLogging(): void {
        const startTime = Date.now();
        
        this.streamer.on('*', (event) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            const prefix = `[${elapsed}s]`;
            
            switch (event.type) {
                case StreamEventType.NODE_START:
                    console.log(`${prefix} 🚀 Starting ${event.sourceNode}...`);
                    break;
                    
                case StreamEventType.EXEC_COMPLETE:
                    const duration = event.payload.durationMs;
                    console.log(`${prefix} ⚡ ${event.sourceNode} complete (${duration}ms)`);
                    break;
                    
                case StreamEventType.NODE_END:
                    console.log(`${prefix} ✅ ${event.sourceNode} → ${event.payload.action}`);
                    break;
                    
                case StreamEventType.ERROR:
                    console.log(`${prefix} ❌ Error in ${event.sourceNode}: ${event.payload.error}`);
                    break;
                    
                case StreamEventType.BACKPACK_PACK:
                    console.log(`${prefix} 💾 Packed '${event.payload.key}'`);
                    break;
            }
        });
    }
    
    /**
     * Run the research agent
     */
    async research(query: string): Promise<void> {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 YouTube Research Agent`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Query: "${query}"\n`);
        
        // Show the flow architecture
        this.displayFlowArchitecture();
        
        try {
            // Pack initial input
            this.backpack.pack('searchQuery', query, {
                nodeId: 'user-input',
                nodeName: 'UserInput'
            });
            
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`🎬 EXECUTION TIMELINE`);
            console.log(`${'─'.repeat(80)}\n`);
            
            // Run the flow
            await this.flow.run({});
            
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`✅ Flow Complete!`);
            console.log(`${'─'.repeat(80)}`);
            
            // Display execution summary
            this.displayExecutionSummary();
            
            // Display results
            this.displayResults();
            
        } catch (error: any) {
            console.error(`\n❌ Agent failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Display the flow architecture
     */
    private displayFlowArchitecture(): void {
        console.log(`📊 AGENT ARCHITECTURE`);
        console.log(`${'─'.repeat(80)}\n`);
        console.log(`   ┌─────────────────────┐`);
        console.log(`   │  User Query Input   │`);
        console.log(`   └──────────┬──────────┘`);
        console.log(`              │ searchQuery`);
        console.log(`              ▼`);
        console.log(`   ┌─────────────────────┐`);
        console.log(`   │ YouTubeSearchNode   │ → Search YouTube API`);
        console.log(`   │  (youtube.research  │    Get 50 videos with stats`);
        console.log(`   │      .search)       │`);
        console.log(`   └──────────┬──────────┘`);
        console.log(`              │ searchResults, searchMetadata`);
        console.log(`              ▼`);
        console.log(`   ┌─────────────────────┐`);
        console.log(`   │  DataAnalysisNode   │ → Find channel-relative outliers`);
        console.log(`   │  (youtube.research  │    Compare each video to its`);
        console.log(`   │     .analysis)      │    channel's baseline`);
        console.log(`   └──────────┬──────────┘`);
        console.log(`              │ outliers, statistics, prompt`);
        console.log(`              ▼`);
        console.log(`   ┌─────────────────────┐`);
        console.log(`   │BaseChatCompletionNode│ → Generate AI insights`);
        console.log(`   │  (youtube.research  │    Explain why videos succeeded`);
        console.log(`   │     .summary)       │`);
        console.log(`   └──────────┬──────────┘`);
        console.log(`              │ chatResponse`);
        console.log(`              ▼`);
        console.log(`   ┌─────────────────────┐`);
        console.log(`   │   Final Results     │`);
        console.log(`   └─────────────────────┘\n`);
    }
    
    /**
     * Display execution summary with timeline
     */
    private displayExecutionSummary(): void {
        const history = this.streamer.getHistory();
        const nodeExecutions: Map<string, { start: number, end: number, duration: number }> = new Map();
        
        // Build timeline of node executions
        for (const event of history) {
            if (event.type === StreamEventType.NODE_START) {
                nodeExecutions.set(event.sourceNode, {
                    start: event.timestamp,
                    end: 0,
                    duration: 0
                });
            } else if (event.type === StreamEventType.NODE_END) {
                const exec = nodeExecutions.get(event.sourceNode);
                if (exec) {
                    exec.end = event.timestamp;
                    exec.duration = exec.end - exec.start;
                }
            }
        }
        
        console.log(`\n📈 EXECUTION SUMMARY`);
        console.log(`${'─'.repeat(80)}\n`);
        
        const startTime = Math.min(...Array.from(nodeExecutions.values()).map(e => e.start));
        
        for (const [nodeName, exec] of nodeExecutions) {
            const relativeStart = ((exec.start - startTime) / 1000).toFixed(2);
            const relativeEnd = ((exec.end - startTime) / 1000).toFixed(2);
            const duration = (exec.duration / 1000).toFixed(2);
            
            console.log(`   ${nodeName}`);
            console.log(`   ├─ Started:  ${relativeStart}s`);
            console.log(`   ├─ Finished: ${relativeEnd}s`);
            console.log(`   └─ Duration: ${duration}s\n`);
        }
        
        // Show data flow through Backpack
        console.log(`📦 DATA FLOW (Backpack State Changes)`);
        console.log(`${'─'.repeat(80)}\n`);
        
        const packEvents = history.filter(e => e.type === StreamEventType.BACKPACK_PACK);
        const dataFlow: { [key: string]: string[] } = {};
        
        for (const event of packEvents) {
            const key = event.payload.key;
            const source = event.payload.metadata?.nodeName || event.payload.metadata?.nodeId || 'unknown';
            
            if (!dataFlow[key]) {
                dataFlow[key] = [];
            }
            dataFlow[key].push(source);
        }
        
        for (const [key, sources] of Object.entries(dataFlow)) {
            console.log(`   '${key}' ← ${sources[sources.length - 1]}`);
        }
        console.log();
    }
    
    /**
     * Display final results
     */
    private displayResults(): void {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 RESULTS`);
        console.log(`${'='.repeat(80)}\n`);
        
        // Get results from backpack
        const searchMetadata = this.backpack.unpack('searchMetadata');
        const statistics = this.backpack.unpack('statistics');
        const outliers = this.backpack.unpack('outliers');
        const insights = this.backpack.unpack('insights');
        const summary = this.backpack.unpack('chatResponse');
        
        // Display search metadata
        if (searchMetadata) {
            console.log(`📺 Search Results: ${searchMetadata.totalResults} videos found`);
            console.log(`🔎 Query: "${searchMetadata.query}"\n`);
        }
        
        // Display statistics
        if (statistics) {
            console.log(`📈 Statistics:`);
            console.log(`   Mean views: ${this.formatNumber(statistics.mean)}`);
            console.log(`   Median views: ${this.formatNumber(statistics.median)}`);
            console.log(`   Range: ${this.formatNumber(statistics.min)} - ${this.formatNumber(statistics.max)}\n`);
        }
        
        // Display insights
        if (insights && insights.length > 0) {
            console.log(`💡 Analysis Insights:`);
            insights.forEach((insight: string) => {
                console.log(`   • ${insight}`);
            });
            console.log();
        }
        
        // Display outlier videos
        if (outliers && outliers.length > 0) {
            console.log(`🌟 Top ${Math.min(5, outliers.length)} Outlier Videos (Breakthrough Performers):\n`);
            
            outliers.slice(0, 5).forEach((video: any, index: number) => {
                console.log(`${index + 1}. ${video.title}`);
                console.log(`   Channel: ${video.channelTitle}`);
                console.log(`   Views: ${this.formatNumber(video.views)}`);
                
                // Show outlier score if available
                if (video.outlierScore && video.channelBaseline) {
                    console.log(`   Channel's avg views: ${this.formatNumber(video.channelBaseline)}`);
                    console.log(`   🚀 Performance: ${video.outlierScore.toFixed(1)}x better than channel average!`);
                }
                
                console.log(`   Likes: ${this.formatNumber(video.likes)}`);
                console.log(`   URL: ${video.url}\n`);
            });
        }
        
        // Display AI summary
        if (summary) {
            console.log(`🤖 AI Analysis:\n`);
            console.log(summary);
            console.log();
        }
        
        // Display observability stats
        const stats = this.streamer.getStats();
        console.log(`${'='.repeat(80)}`);
        console.log(`📊 Observability Stats:`);
        console.log(`   Total Events: ${stats.totalEvents}`);
        console.log(`   Nodes Executed: ${stats.uniqueNodes}`);
        console.log(`   Namespaces: ${stats.uniqueNamespaces}`);
        console.log(`${'='.repeat(80)}\n`);
    }
    
    /**
     * Format number for display
     */
    private formatNumber(num: number): string {
        if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
            return `${(num / 1_000).toFixed(1)}K`;
        }
        return num.toString();
    }
}

/**
 * Main execution
 */
async function main() {
    // Get query from command line args
    const query = process.argv[2] || 'AI productivity tools';
    
    // Check for required environment variables
    if (!process.env.YOUTUBE_API_KEY) {
        console.error('❌ Error: YOUTUBE_API_KEY environment variable is required');
        console.error('   Get your API key from: https://console.cloud.google.com/apis/credentials');
        process.exit(1);
    }
    
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Error: OPENAI_API_KEY environment variable is required');
        process.exit(1);
    }
    
    // Create and run agent
    const agent = new YouTubeResearchAgent();
    await agent.research(query);
}

// Run if executed directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { YouTubeResearchAgent };

