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
import { BackpackNode } from '../../src/nodes/backpack-node';
import { BaseChatCompletionNode } from './base-chat-completion-node';
import { YouTubeSearchNode } from './youtube-search-node';
import { DataAnalysisNode } from './data-analysis-node';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * YouTube Research Agent Node
 * 
 * A composable agent that can be added to any flow.
 * Internally manages its own 3-node pipeline.
 * 
 * Architecture:
 *   Search → Analyze → Summarize
 * 
 * Flow:
 *   1. YouTubeSearchNode: Search YouTube for query
 *   2. DataAnalysisNode: Find outlier videos (channel-relative)
 *   3. BaseChatCompletionNode: Explain why outliers are successful
 */
class YouTubeResearchAgentNode extends BackpackNode {
    static namespaceSegment = "agent";
    
    async prep(shared: any): Promise<any> {
        // Get query from backpack
        const query = this.unpackRequired<string>('searchQuery');
        return { query };
    }
    
    async _exec(input: any): Promise<any> {
        // Create internal flow that inherits our namespace
        // If we're at "youtube.research.agent", internal nodes become:
        // - "youtube.research.agent.search"
        // - "youtube.research.agent.analysis"
        // - "youtube.research.agent.summary"
        const internalFlow = new Flow({
            namespace: this.namespace,
            backpack: this.backpack,
            eventStreamer: (this as any).eventStreamer
        });
        
        // 1. YouTube Search Node
        const searchNode = internalFlow.addNode(YouTubeSearchNode, {
            id: 'search',
            apiKey: process.env.YOUTUBE_API_KEY || '',
            maxResults: 50
        });
        
        // 2. Data Analysis Node
        const analysisNode = internalFlow.addNode(DataAnalysisNode, {
            id: 'analysis',
            metric: 'views',
            threshold: 1.5 // 1.5x channel average = breakthrough video
        });
        
        // 3. Chat Completion Node (for insights)
        const summaryNode = internalFlow.addNode(BaseChatCompletionNode, {
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
        searchNode.on('complete', analysisNode);
        analysisNode.on('complete', summaryNode);
        
        // Set entry node and run
        internalFlow.setEntryNode(searchNode);
        await internalFlow.run({});
        
        return { success: true };
    }
    
    async post(backpack: any, shared: any, output: any): Promise<string | undefined> {
        return 'complete';
    }
}

/**
 * YouTube Research Agent Orchestrator
 * 
 * Sets up the agent and provides a clean interface for running queries.
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
        
        // Create main flow
        this.flow = new Flow({
            namespace: 'youtube.research',
            backpack: this.backpack,
            eventStreamer: this.streamer
        });
        
        // Add the agent node (which contains the internal flow)
        const agentNode = this.flow.addNode(YouTubeResearchAgentNode, {
            id: 'agent'
        });
        
        this.flow.setEntryNode(agentNode);
        
        // Setup event logging with nesting support
        this.setupEventLogging();
    }
    
    /**
     * Setup event logging for observability with hierarchical nested flow support
     */
    private setupEventLogging(): void {
        const startTime = Date.now();
        const nodeStack: Array<{ name: string, startTime: number, namespace: string }> = [];
        
        this.streamer.on('*', (event) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            
            // Calculate nesting depth from namespace
            const namespace = event.namespace || '';
            const namespaceDepth = namespace.split('.').length;
            
            // Indent based on how many parents are currently open
            const openParentsCount = nodeStack.filter(n => 
                namespace.startsWith(n.namespace + '.') && n.namespace !== namespace
            ).length;
            const indent = '│  '.repeat(openParentsCount);
            
            switch (event.type) {
                case StreamEventType.NODE_START:
                    // Close previous sibling nodes at same level
                    while (nodeStack.length > 0) {
                        const top = nodeStack[nodeStack.length - 1];
                        const topDepth = top.namespace.split('.').length;
                        
                        // If top is at same level or deeper, and not a parent of current
                        if (topDepth >= namespaceDepth && !namespace.startsWith(top.namespace + '.')) {
                            const closingNode = nodeStack.pop()!;
                            const closingDepth = closingNode.namespace.split('.').length;
                            const closingParents = nodeStack.filter(n => 
                                closingNode.namespace.startsWith(n.namespace + '.')
                            ).length;
                            const closingIndent = '│  '.repeat(closingParents);
                            const nodeDuration = ((Date.now() - closingNode.startTime) / 1000).toFixed(2);
                            console.log(`${closingIndent}└─ [${elapsed}s] ✓ Complete (${nodeDuration}s total)\n`);
                        } else {
                            break;
                        }
                    }
                    
                    // Start new node with proper indentation
                    nodeStack.push({ name: event.sourceNode, startTime: Date.now(), namespace });
                    
                    const padding = '─'.repeat(Math.max(0, 60 - indent.length - event.sourceNode.length));
                    console.log(`${indent}┌─ ${event.sourceNode} ${padding}`);
                    console.log(`${indent}│  [${elapsed}s] 🚀 Starting...`);
                    break;
                    
                case StreamEventType.PREP_COMPLETE:
                    console.log(`${indent}│  [${elapsed}s] ✓ Preparation phase complete`);
                    break;
                    
                case StreamEventType.EXEC_COMPLETE:
                    const duration = event.payload.durationMs;
                    // Only show for leaf nodes or when they're actually doing work
                    if (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].namespace === namespace) {
                        console.log(`${indent}│  [${elapsed}s] ⚡ Execution complete (${duration}ms)`);
                    }
                    break;
                    
                case StreamEventType.NODE_END:
                    // Find the matching node in the stack
                    const nodeIndex = nodeStack.findIndex(n => n.namespace === namespace);
                    if (nodeIndex !== -1) {
                        // Close all children first
                        while (nodeStack.length > nodeIndex + 1) {
                            const childNode = nodeStack.pop()!;
                            const childParents = nodeStack.filter(n => 
                                childNode.namespace.startsWith(n.namespace + '.')
                            ).length;
                            const childIndent = '│  '.repeat(childParents);
                            const childDuration = ((Date.now() - childNode.startTime) / 1000).toFixed(2);
                            console.log(`${childIndent}└─ [${elapsed}s] ✓ Complete (${childDuration}s total)\n`);
                        }
                        
                        // Now close this node
                        const node = nodeStack.pop()!;
                        const nodeDuration = ((Date.now() - node.startTime) / 1000).toFixed(2);
                        const action = event.payload.action;
                        console.log(`${indent}│  [${elapsed}s] → Next: ${action}`);
                        console.log(`${indent}└─ [${elapsed}s] ✓ Complete (${nodeDuration}s total)\n`);
                    }
                    break;
                    
                case StreamEventType.ERROR:
                    console.log(`${indent}│  [${elapsed}s] ❌ Error: ${event.payload.error}`);
                    const errorNodeIndex = nodeStack.findIndex(n => n.namespace === namespace);
                    if (errorNodeIndex !== -1) {
                        console.log(`${indent}└─ [${elapsed}s] ✗ Failed\n`);
                        nodeStack.splice(errorNodeIndex, 1);
                    }
                    break;
                    
                case StreamEventType.BACKPACK_PACK:
                    const key = event.payload.key;
                    console.log(`${indent}│  [${elapsed}s] 💾 Packed '${key}'`);
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
        
        try {
            // Pack initial input
            this.backpack.pack('searchQuery', query, {
                nodeId: 'user-input',
                nodeName: 'UserInput'
            });
            
            console.log(`${'─'.repeat(80)}`);
            console.log(`🎬 EXECUTION TIMELINE`);
            console.log(`${'─'.repeat(80)}\n`);
            
            // Run the flow
            await this.flow.run({});
            
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`✅ Flow Complete!`);
            console.log(`${'─'.repeat(80)}`);
            
            // Show the architecture that was executed
            this.displayFlowArchitecture();
            
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
     * Display the flow architecture dynamically from event history
     * Shows the actual execution structure with nested flows
     */
    private displayFlowArchitecture(): void {
        console.log(`\n📊 FLOW ARCHITECTURE`);
        console.log(`${'─'.repeat(80)}\n`);
        
        // Build node tree from event history
        const history = this.streamer.getHistory();
        const nodes: Array<{ name: string, namespace: string }> = [];
        
        for (const event of history) {
            if (event.type === StreamEventType.NODE_START) {
                const nodeName = event.sourceNode;
                const namespace = event.namespace || '';
                if (!nodes.find(n => n.namespace === namespace)) {
                    nodes.push({ name: nodeName, namespace });
                }
            }
        }
        
        // Sort by namespace depth to show hierarchy
        nodes.sort((a, b) => {
            const depthA = a.namespace.split('.').length;
            const depthB = b.namespace.split('.').length;
            if (depthA !== depthB) return depthA - depthB;
            return a.namespace.localeCompare(b.namespace);
        });
        
        console.log(`   User Input`);
        console.log(`        ↓`);
        
        for (const node of nodes) {
            const depth = node.namespace.split('.').length - 2; // Subtract base depth
            const indent = '      '.repeat(Math.max(0, depth));
            const isParent = nodes.some(n => n.namespace.startsWith(node.namespace + '.'));
            const marker = isParent ? '📦' : '⚙️ ';
            
            console.log(`${indent}${marker} ${node.name}`);
            console.log(`${indent}   (${node.namespace})`);
            
            if (isParent) {
                console.log(`${indent}   ├─ Internal Flow:`);
            } else {
                console.log(`${indent}        ↓`);
            }
        }
        
        console.log(`   Final Results\n`);
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
        const dataFlow: { [key: string]: string } = {};
        
        for (const event of packEvents) {
            const key = event.payload.key;
            // Use sourceNode from event, which is the node class name
            const source = event.sourceNode || event.payload.metadata?.nodeName || event.payload.metadata?.nodeId || 'UserInput';
            
            // Keep the last source (most recent)
            dataFlow[key] = source;
        }
        
        // Group by source for better readability
        const sourceGroups: { [source: string]: string[] } = {};
        for (const [key, source] of Object.entries(dataFlow)) {
            if (!sourceGroups[source]) {
                sourceGroups[source] = [];
            }
            sourceGroups[source].push(key);
        }
        
        for (const [source, keys] of Object.entries(sourceGroups)) {
            console.log(`   ${source}:`);
            for (const key of keys) {
                console.log(`      → '${key}'`);
            }
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

