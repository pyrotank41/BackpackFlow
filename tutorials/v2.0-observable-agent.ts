#!/usr/bin/env ts-node
/**
 * BackpackFlow v2.0 - Complete Observability Demo
 * 
 * Demonstrates FULL v2.0 stack:
 * ✅ PRD-001: Backpack Architecture (state + history + access control)
 * ✅ PRD-002: Telemetry System (event streaming + observability)
 * 
 * This is a production-ready research agent with:
 * - Real-time event monitoring
 * - Complete lifecycle visibility
 * - Observability dashboard
 * - Time-travel debugging
 * - Multi-agent coordination with access control
 * 
 * Run: npm run demo:observable-agent "your research query"
 */

import { Backpack } from '../src/storage';
import { EventStreamer, StreamEventType, BackpackEvent } from '../src/events';
import { BackpackNode, NodeConfig, NodeContext } from '../src/nodes/backpack-node';
import { Flow } from '../src/flows/flow';

// ===== OBSERVABILITY DASHBOARD =====

class ObservabilityDashboard {
    private events: BackpackEvent[] = [];
    private startTime = Date.now();
    
    constructor(private streamer: EventStreamer) {
        // Subscribe to ALL events
        this.streamer.on('*', (event) => {
            this.events.push(event);
            this.logEvent(event);
        });
    }
    
    private logEvent(event: BackpackEvent): void {
        const elapsed = ((event.timestamp - this.startTime) / 1000).toFixed(2);
        const namespace = event.namespace || 'system';
        
        switch (event.type) {
            case StreamEventType.NODE_START:
                console.log(`\n⏱️  [${elapsed}s] 🚀 START ${event.sourceNode} (${namespace})`);
                break;
                
            case StreamEventType.PREP_COMPLETE:
                const prep = event.payload as any;
                console.log(`   [${elapsed}s] 📝 PREP complete - reads: [${prep.backpackReads.join(', ') || 'none'}]`);
                break;
                
            case StreamEventType.EXEC_COMPLETE:
                const exec = event.payload as any;
                console.log(`   [${elapsed}s] ⚡ EXEC complete - ${exec.durationMs}ms`);
                break;
                
            case StreamEventType.NODE_END:
                const end = event.payload as any;
                console.log(`   [${elapsed}s] ✅ END ${event.sourceNode} → action: "${end.action}" - writes: [${end.backpackWrites.join(', ') || 'none'}]`);
                break;
                
            case StreamEventType.ERROR:
                const error = event.payload as any;
                console.log(`   [${elapsed}s] ❌ ERROR in ${error.phase}: ${error.error}`);
                break;
                
            case StreamEventType.BACKPACK_PACK:
                const pack = event.payload as any;
                console.log(`   [${elapsed}s] 💾 PACK "${pack.key}" by ${pack.metadata.sourceNodeName}`);
                break;
                
            case StreamEventType.BACKPACK_UNPACK:
                const unpack = event.payload as any;
                const status = unpack.accessGranted ? '✅' : '🚫';
                console.log(`   [${elapsed}s] 📦 UNPACK "${unpack.key}" ${status} ${unpack.reason || ''}`);
                break;
        }
    }
    
    printSummary(): void {
        console.log('\n' + '═'.repeat(80));
        console.log('📊 OBSERVABILITY SUMMARY');
        console.log('═'.repeat(80));
        
        const stats = this.streamer.getStats();
        const totalDuration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        
        console.log(`\n⏱️  Total Execution Time: ${totalDuration}s`);
        console.log(`📈 Total Events: ${stats.totalEvents}`);
        console.log(`🔢 Unique Nodes: ${stats.uniqueNodes}`);
        console.log(`📂 Unique Namespaces: ${stats.uniqueNamespaces}`);
        
        console.log('\n📋 Events by Type:');
        for (const [type, count] of Object.entries(stats.eventsByType)) {
            console.log(`   ${type}: ${count}`);
        }
        
        // Show lifecycle events by node
        console.log('\n🔄 Node Execution Order:');
        const startEvents = this.streamer.getEventsByType(StreamEventType.NODE_START);
        startEvents.forEach((event, i) => {
            const endEvent = this.streamer.getNodeEvents(event.nodeId)
                .find(e => e.type === StreamEventType.NODE_END);
            const duration = endEvent ? (event.payload as any).durationMs : '?';
            console.log(`   ${i + 1}. ${event.sourceNode} (${event.namespace}) - ${duration}ms`);
        });
        
        // Show namespace activity
        console.log('\n🗂️  Activity by Namespace:');
        const namespaces = new Set(this.events.filter(e => e.namespace).map(e => e.namespace!));
        namespaces.forEach(ns => {
            const nsEvents = this.streamer.getNamespaceEvents(ns);
            console.log(`   ${ns}: ${nsEvents.length} events`);
        });
    }
}

// ===== RESEARCH AGENT NODES =====

/**
 * ChatNode - Analyzes user query and determines research strategy
 */
class ChatNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        const query = this.unpackRequired<string>('userQuery');
        
        // Simulate LLM analysis
        await this.simulateThinking(200);
        
        const needsResearch = /search|find|research|learn|what|how|explain/i.test(query);
        const complexity = query.split(' ').length > 5 ? 'complex' : 'simple';
        
        const analysis = {
            query,
            needsResearch,
            complexity,
            confidence: needsResearch ? 0.92 : 0.45,
            reasoning: needsResearch 
                ? 'Query requires external knowledge - proceeding to research'
                : 'Can answer directly from existing knowledge'
        };
        
        return analysis;
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        this.pack('chatAnalysis', execRes);
        return execRes.needsResearch ? 'research' : 'direct_answer';
    }
    
    private async simulateThinking(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * ResearchNode - Gathers information from multiple sources
 */
class ResearchNode extends BackpackNode {
    static namespaceSegment = "research";
    
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        const query = this.unpack<string>('userQuery');
        const analysis = this.unpack<any>('chatAnalysis');
        
        // Simulate research (with proper delay for observability)
        await this.simulateResearch(500);
        
        const sources = [
            {
                id: 'src-1',
                title: `Understanding: ${query}`,
                snippet: `Comprehensive guide with ${analysis?.complexity} explanations`,
                url: 'https://docs.example.com/guide',
                relevance: 0.95,
                citations: 42
            },
            {
                id: 'src-2',
                title: `Best Practices: ${query}`,
                snippet: 'Industry standards and proven patterns',
                url: 'https://blog.example.com/best-practices',
                relevance: 0.88,
                citations: 28
            },
            {
                id: 'src-3',
                title: `Advanced Techniques`,
                snippet: 'Deep dive into optimization strategies',
                url: 'https://advanced.example.com/tutorial',
                relevance: 0.82,
                citations: 15
            }
        ];
        
        return {
            sources,
            totalFound: sources.length,
            avgRelevance: sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length,
            researchTime: 500
        };
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        this.pack('researchResults', execRes.sources);
        this.pack('researchMetadata', {
            totalSources: execRes.totalFound,
            avgRelevance: execRes.avgRelevance,
            researchTime: execRes.researchTime,
            timestamp: new Date().toISOString()
        });
        return 'synthesize';
    }
    
    private async simulateResearch(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * SynthesisNode - Creates comprehensive summary from research
 */
class SynthesisNode extends BackpackNode {
    static namespaceSegment = "synthesis";
    
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        const query = this.unpack<string>('userQuery');
        const sources = this.unpackRequired<any[]>('researchResults');
        const metadata = this.unpack<any>('researchMetadata');
        
        // Simulate synthesis
        await this.simulateSynthesis(400);
        
        // Demonstrate namespace queries
        const allResearchData = this.unpackByNamespace('*.research.*');
        
        const synthesis = {
            query,
            summary: `Based on ${sources.length} authoritative sources about "${query}":\n\n` +
                sources.map((s, i) => `${i + 1}. ${s.title} (${(s.relevance * 100).toFixed(0)}% relevant, ${s.citations} citations)`).join('\n'),
            keyFindings: sources.map(s => ({
                source: s.title,
                insight: s.snippet,
                reliability: s.relevance
            })),
            confidence: metadata?.avgRelevance || 0.85,
            sourcesAnalyzed: sources.length,
            synthesisTime: 400,
            timestamp: new Date().toISOString()
        };
        
        return synthesis;
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        this.pack('finalSynthesis', execRes);
        return undefined; // End of flow
    }
    
    private async simulateSynthesis(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * DirectAnswerNode - Handles simple queries without research
 */
class DirectAnswerNode extends BackpackNode {
    static namespaceSegment = "directAnswer";
    
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        const query = this.unpack<string>('userQuery');
        const analysis = this.unpack<any>('chatAnalysis');
        
        await this.simulateThinking(150);
        
        const answer = {
            query,
            response: `Direct answer about "${query}" based on existing knowledge.`,
            confidence: analysis?.confidence || 0.7,
            type: 'direct',
            responseTime: 150,
            timestamp: new Date().toISOString()
        };
        
        return answer;
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        this.pack('directAnswer', execRes);
        return undefined; // End of flow
    }
    
    private async simulateThinking(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ===== NESTED RESEARCH AGENT =====

/**
 * ResearchAgentNode - Orchestrates the entire research workflow
 */
class ResearchAgentNode extends BackpackNode {
    static namespaceSegment = "agent";
    
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        // Create internal flow with namespace inheritance
        const internalFlow = new Flow({
            namespace: this.namespace,
            backpack: this.backpack,
            eventStreamer: (this as any).eventStreamer // Pass eventStreamer to internal flow
        });
        
        // Setup access control for internal nodes
        this.backpack.registerPermissions('chat', {
            write: ['chatAnalysis'],
            read: ['userQuery'],
            namespaceWrite: [`${this.namespace}.chat.*`]
        });
        
        this.backpack.registerPermissions('research', {
            write: ['researchResults', 'researchMetadata'],
            read: ['userQuery', 'chatAnalysis'],
            namespaceRead: [`${this.namespace}.chat.*`],
            namespaceWrite: [`${this.namespace}.research.*`]
        });
        
        this.backpack.registerPermissions('synthesis', {
            write: ['finalSynthesis'],
            read: ['userQuery', 'researchResults', 'researchMetadata'],
            namespaceRead: [`${this.namespace}.*`],
            namespaceWrite: [`${this.namespace}.synthesis.*`]
        });
        
        this.backpack.registerPermissions('directAnswer', {
            write: ['directAnswer'],
            read: ['userQuery', 'chatAnalysis'],
            namespaceWrite: [`${this.namespace}.directAnswer.*`]
        });
        
        // Build internal workflow
        const chat = internalFlow.addNode(ChatNode, { id: 'chat' });
        const research = internalFlow.addNode(ResearchNode, { id: 'research' });
        const synthesis = internalFlow.addNode(SynthesisNode, { id: 'synthesis' });
        const directAnswer = internalFlow.addNode(DirectAnswerNode, { id: 'directAnswer' });
        
        // Define routing
        chat.on('research', research);
        chat.on('direct_answer', directAnswer);
        research.on('synthesize', synthesis);
        
        // Execute internal workflow
        await internalFlow.run(chat, prepRes);
        
        return { completed: true };
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        return undefined;
    }
}

// ===== MAIN APPLICATION =====

async function runObservableAgent(userQuery: string) {
    console.log('\n' + '═'.repeat(80));
    console.log('🚀 BackpackFlow v2.0 - Complete Observability Demo');
    console.log('═'.repeat(80));
    console.log(`\n📥 Query: "${userQuery}"\n`);
    
    // Create EventStreamer for full observability
    const streamer = new EventStreamer({
        enableHistory: true,
        maxHistorySize: 1000,
        syncEmission: true // Sync for console output
    });
    
    // Create Observability Dashboard
    const dashboard = new ObservabilityDashboard(streamer);
    
    // Create Backpack with telemetry
    const backpack = new Backpack({}, {
        eventStreamer: streamer,
        runId: `run-${Date.now()}`,
        enableAccessControl: true,
        strictMode: false
    });
    
    // Create main flow with event streaming
    const mainFlow = new Flow({
        namespace: 'main',
        backpack,
        eventStreamer: streamer
    });
    
    console.log('🏗️  Building research agent with full observability...\n');
    
    // Add the research agent
    const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
    
    // Pack initial query
    backpack.pack('userQuery', userQuery, {
        nodeId: 'system',
        nodeName: 'UserInput',
        namespace: 'system.input'
    });
    
    // Run the agent with full event streaming
    console.log('═'.repeat(80));
    console.log('📡 LIVE EVENT STREAM');
    console.log('═'.repeat(80));
    
    await mainFlow.run(agent, { query: userQuery });
    
    // Print observability summary
    dashboard.printSummary();
    
    // ===== DEMONSTRATE v2.0 FEATURES =====
    
    console.log('\n' + '═'.repeat(80));
    console.log('🎯 v2.0 FEATURES SHOWCASE');
    console.log('═'.repeat(80));
    
    // 1. Event Filtering
    console.log('\n1️⃣  Event Filtering:');
    console.log('─'.repeat(80));
    
    const nodeStartEvents = streamer.getEventsByType(StreamEventType.NODE_START);
    console.log(`   NODE_START events: ${nodeStartEvents.length}`);
    nodeStartEvents.forEach(e => {
        console.log(`      • ${e.sourceNode} in ${e.namespace}`);
    });
    
    const packEvents = streamer.getEventsByType(StreamEventType.BACKPACK_PACK);
    console.log(`\n   BACKPACK_PACK events: ${packEvents.length}`);
    
    // 2. Namespace Filtering
    console.log('\n2️⃣  Namespace Filtering:');
    console.log('─'.repeat(80));
    
    const agentEvents = streamer.getNamespaceEvents('main.agent.*');
    console.log(`   Events in "main.agent.*": ${agentEvents.length}`);
    
    const researchEvents = streamer.getNamespaceEvents('*.research.*');
    console.log(`   Events in "*.research.*": ${researchEvents.length}`);
    
    // 3. Time-Travel Debugging
    console.log('\n3️⃣  Time-Travel Debugging:');
    console.log('─'.repeat(80));
    
    const history = backpack.getHistory();
    console.log(`   Total commits: ${history.length}`);
    
    if (history.length > 2) {
        const midCommit = history[Math.floor(history.length / 2)];
        const snapshot = backpack.getSnapshotAtCommit(midCommit.commitId);
        
        console.log(`   Snapshot at commit ${midCommit.commitId.slice(0, 8)}:`);
        console.log(`      State size: ${snapshot.size()} items`);
        console.log(`      Can replay from this point! ✅`);
    }
    
    // 4. Access Control
    console.log('\n4️⃣  Access Control:');
    console.log('─'.repeat(80));
    
    const permissions = backpack.getPermissions();
    console.log(`   Permission sets: ${permissions.size}`);
    permissions.forEach((perms, nodeId) => {
        console.log(`   • ${nodeId}:`);
        if (perms.read) console.log(`     Read: ${perms.read.length} keys`);
        if (perms.write) console.log(`     Write: ${perms.write.length} keys`);
    });
    
    // 5. Final Results
    console.log('\n5️⃣  Agent Output:');
    console.log('─'.repeat(80));
    
    const synthesis = backpack.unpack('finalSynthesis');
    const directAnswer = backpack.unpack('directAnswer');
    
    if (synthesis) {
        console.log(`   ✅ Research Complete`);
        console.log(`   📝 ${synthesis.summary}`);
        console.log(`   🎯 Confidence: ${(synthesis.confidence * 100).toFixed(0)}%`);
        console.log(`   ⏱️  Research: ${synthesis.synthesisTime}ms`);
    } else if (directAnswer) {
        console.log(`   ✅ Direct Answer`);
        console.log(`   💬 ${directAnswer.response}`);
        console.log(`   🎯 Confidence: ${(directAnswer.confidence * 100).toFixed(0)}%`);
        console.log(`   ⏱️  Response: ${directAnswer.responseTime}ms`);
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('✨ Demo Complete!');
    console.log('═'.repeat(80));
    
    console.log('\n🎓 What You Just Saw:\n');
    console.log('   ✅ Real-time event streaming (PRD-002)');
    console.log('   ✅ Complete lifecycle visibility');
    console.log('   ✅ Backpack state management (PRD-001)');
    console.log('   ✅ Access control between nodes');
    console.log('   ✅ Namespace-based filtering');
    console.log('   ✅ Time-travel debugging');
    console.log('   ✅ Event history & statistics');
    console.log('   ✅ Nested agent architecture');
    
    console.log('\n💡 Use Cases:\n');
    console.log('   • Debug production agents in real-time');
    console.log('   • Build observability dashboards');
    console.log('   • Trace data flow through complex workflows');
    console.log('   • Replay and analyze past executions');
    console.log('   • Monitor access control violations');
    console.log('   • Optimize agent performance\n');
}

// ===== CLI =====

async function main() {
    const args = process.argv.slice(2);
    const userQuery = args.length > 0
        ? args.join(' ')
        : 'How does machine learning work?';
    
    try {
        await runObservableAgent(userQuery);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { runObservableAgent, ResearchAgentNode };

