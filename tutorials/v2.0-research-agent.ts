#!/usr/bin/env ts-node
/**
 * BackpackFlow v2.0 - Research Agent Tutorial
 * 
 * Demonstrates ALL v2.0 features through a nested agent architecture:
 * ✅ BackpackNode - Base class with auto metadata
 * ✅ Flow - Namespace composition  
 * ✅ Backpack - State management with history
 * ✅ Nested Flows - Agent with internal workflow
 * ✅ Access Control - Permissions between nodes
 * ✅ Namespace Queries - Filter by patterns
 * ✅ Time-Travel - Debug with snapshots
 * ✅ History Tracking - Complete execution trace
 * 
 * Architecture:
 *   ResearchAgentNode (main agent)
 *   └─ Internal Flow:
 *      ├─ ChatNode (analyze query)
 *      ├─ ResearchNode (gather sources)
 *      ├─ SynthesisNode (create summary)
 *      └─ DirectAnswerNode (simple queries)
 * 
 * Run: npm run tutorial:research-agent "your research query"
 */

import { BackpackNode, NodeConfig, NodeContext } from '../src/nodes/backpack-node';
import { Flow } from '../src/flows/flow';

// ===== INTERNAL WORKFLOW NODES =====

/**
 * ChatNode - Analyzes user query and routes to appropriate handler
 */
class ChatNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    async prep(shared: any): Promise<any> {
        console.log('   🤖 [Chat] Analyzing query...');
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        const userQuery = prepRes?.query || 'No query provided';
        
        // Pack with automatic metadata injection
        this.pack('userQuery', userQuery);
        
        // Analyze intent
        const needsResearch = /search|find|research|learn|what is|how to/i.test(userQuery);
        
        const analysis = {
            query: userQuery,
            needsResearch,
            confidence: needsResearch ? 0.9 : 0.3,
            intent: needsResearch ? 'research_required' : 'direct_answer'
        };
        
        this.pack('chatAnalysis', analysis);
        
        console.log(`      → Intent: ${analysis.intent} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);
        
        return { needsResearch };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return execRes.needsResearch ? 'needs_research' : 'direct_answer';
    }
}

/**
 * ResearchNode - Gathers information from sources
 */
class ResearchNode extends BackpackNode {
    static namespaceSegment = "research";
    
    async prep(shared: any): Promise<any> {
        console.log('   🔍 [Research] Gathering sources...');
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        const query = this.unpack('userQuery');
        
        // Simulate research
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const sources = [
            {
                title: `Understanding: ${query}`,
                snippet: `Comprehensive guide to ${query} with practical examples.`,
                url: 'https://docs.example.com/guide',
                relevance: 0.95
            },
            {
                title: `Best Practices: ${query}`,
                snippet: `Industry standards and proven patterns for ${query}.`,
                url: 'https://blog.example.com/best-practices',
                relevance: 0.88
            },
            {
                title: `Advanced ${query}`,
                snippet: `Deep dive into optimization and advanced techniques.`,
                url: 'https://advanced.example.com/tutorial',
                relevance: 0.82
            }
        ];
        
        this.pack('researchSources', sources);
        this.pack('researchMetadata', {
            totalSources: sources.length,
            avgRelevance: sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length,
            timestamp: new Date().toISOString()
        });
        
        console.log(`      → Found ${sources.length} sources (avg relevance: ${(sources[0].relevance * 100).toFixed(0)}%)`);
        
        return { sourcesFound: sources.length };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return 'synthesize';
    }
}

/**
 * SynthesisNode - Creates comprehensive answer from research
 */
class SynthesisNode extends BackpackNode {
    static namespaceSegment = "synthesis";
    
    async prep(shared: any): Promise<any> {
        console.log('   📝 [Synthesis] Creating summary...');
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        // Demonstrate namespace queries
        const researchData = this.unpackByNamespace('*.research.*');
        
        const query = this.unpack('userQuery');
        const sources = this.unpack<any[]>('researchSources') || [];
        const metadata = this.unpack('researchMetadata');
        
        const synthesis = {
            query,
            summary: `Based on ${sources.length} authoritative sources about "${query}"`,
            keyFindings: sources.map(s => ({
                source: s.title,
                insight: s.snippet,
                reliability: s.relevance
            })),
            confidence: metadata?.avgRelevance || 0.8,
            sourcesAnalyzed: sources.length,
            timestamp: new Date().toISOString()
        };
        
        this.pack('finalSynthesis', synthesis);
        
        console.log(`      → Synthesis complete (confidence: ${(synthesis.confidence * 100).toFixed(0)}%)`);
        
        return synthesis;
    }
}

/**
 * DirectAnswerNode - Handles simple queries without research
 */
class DirectAnswerNode extends BackpackNode {
    static namespaceSegment = "directAnswer";
    
    async prep(shared: any): Promise<any> {
        console.log('   💬 [DirectAnswer] Generating response...');
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        const query = this.unpack('userQuery');
        
        const answer = {
            query,
            response: `Quick answer about "${query}" based on existing knowledge.`,
            confidence: 0.7,
            type: 'direct',
            timestamp: new Date().toISOString()
        };
        
        this.pack('directAnswer', answer);
        
        console.log(`      → Direct answer provided (confidence: ${(answer.confidence * 100).toFixed(0)}%)`);
        
        return answer;
    }
}

// ===== MAIN AGENT NODE =====

/**
 * ResearchAgentNode - High-level agent that orchestrates internal workflow
 * 
 * This demonstrates the nested flow pattern - a node that contains
 * an entire workflow inside it. This is how you build complex agents!
 */
class ResearchAgentNode extends BackpackNode {
    static namespaceSegment = "agent";
    
    async prep(shared: any): Promise<any> {
        console.log('\n🤖 Research Agent starting...\n');
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        // Create internal flow that inherits our namespace
        // If we're at "main.agent", internal nodes become "main.agent.chat", etc.
        const internalFlow = new Flow({
            namespace: this.namespace,  // ✅ Namespace inheritance
            backpack: this.backpack     // ✅ Share same Backpack
        });
        
        // Setup access control for internal nodes
        internalFlow.backpack.registerPermissions('chat', {
            write: ['userQuery', 'chatAnalysis'],
            namespaceWrite: [`${this.namespace}.chat.*`]
        });
        
        internalFlow.backpack.registerPermissions('research', {
            read: ['userQuery', 'chatAnalysis'],
            write: ['researchSources', 'researchMetadata'],
            namespaceRead: [`${this.namespace}.chat.*`],
            namespaceWrite: [`${this.namespace}.research.*`]
        });
        
        internalFlow.backpack.registerPermissions('synthesis', {
            read: ['userQuery'],
            write: ['finalSynthesis'],
            namespaceRead: [`${this.namespace}.*`],
            namespaceWrite: [`${this.namespace}.synthesis.*`]
        });
        
        internalFlow.backpack.registerPermissions('direct', {
            read: ['userQuery'],
            write: ['directAnswer'],
            namespaceWrite: [`${this.namespace}.directAnswer.*`]
        });
        
        // Build internal workflow
        const chat = internalFlow.addNode(ChatNode, { id: 'chat' });
        const research = internalFlow.addNode(ResearchNode, { id: 'research' });
        const synthesis = internalFlow.addNode(SynthesisNode, { id: 'synthesis' });
        const directAnswer = internalFlow.addNode(DirectAnswerNode, { id: 'direct' });
        
        // Define routing
        chat.on('needs_research', research);
        chat.on('direct_answer', directAnswer);
        research.on('synthesize', synthesis);
        
        // Execute internal workflow
        await internalFlow.run(chat, prepRes);
        
        return { agentCompleted: true };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        console.log('\n✅ Research Agent completed!\n');
        return undefined;
    }
}

// ===== MAIN APPLICATION =====

async function runDemo(userQuery: string) {
    console.log('\n' + '═'.repeat(80));
    console.log('🚀 BackpackFlow v2.0 - Nested Agent Architecture');
    console.log('═'.repeat(80));
    console.log(`\n📥 Query: "${userQuery}"\n`);
    
    // Create main flow
    const mainFlow = new Flow({ 
        namespace: 'main',
        backpackOptions: {
            enableAccessControl: true,
            strictMode: false,
            maxHistorySize: 1000
        }
    });
    
    // Add the research agent (which contains internal workflow)
    console.log('🏗️  Building agent architecture...\n');
    const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
    
    // Run the agent
    await mainFlow.run(agent, { query: userQuery });
    
    // ===== SHOWCASE ALL v2.0 FEATURES =====
    
    console.log('═'.repeat(80));
    console.log('📊 v2.0 FEATURES DEMONSTRATION');
    console.log('═'.repeat(80));
    
    // 1. Namespace Hierarchy (shows nested structure)
    console.log('\n1️⃣  Namespace Hierarchy (Nested Flow Pattern)');
    console.log('─'.repeat(80));
    const namespaces = mainFlow.backpack.getNamespaces();
    console.log('   Hierarchical structure:');
    console.log('   main.agent                      ← Agent node');
    namespaces.forEach(ns => {
        const items = mainFlow.backpack.getItemsByNamespace(ns);
        const indent = ns.split('.').length > 2 ? '      ├─ ' : '   ';
        console.log(`${indent}${ns} (${items.length} items)`);
    });
    
    // 2. Namespace Queries
    console.log('\n2️⃣  Namespace Queries (Pattern Matching)');
    console.log('─'.repeat(80));
    
    // Query all agent data
    const allAgentData = mainFlow.backpack.unpackByNamespace('main.agent.*');
    console.log(`   🔍 Pattern: "main.agent.*"`);
    console.log(`   📦 Matches: ${Object.keys(allAgentData).length} items`);
    Object.keys(allAgentData).slice(0, 5).forEach(key => {
        console.log(`      • ${key}`);
    });
    
    // Query specific subsystem
    const researchData = mainFlow.backpack.unpackByNamespace('*.research.*');
    console.log(`\n   🔍 Pattern: "*.research.*"`);
    console.log(`   📦 Matches: ${Object.keys(researchData).length} items`);
    
    // 3. Execution History & Tracing
    console.log('\n3️⃣  Execution History (Complete Trace)');
    console.log('─'.repeat(80));
    const history = mainFlow.backpack.getHistory();
    console.log(`   📜 Total commits: ${history.length}`);
    console.log(`   🔄 Execution order:`);
    history.filter(h => h.action === 'pack').slice(0, 6).forEach((commit, i) => {
        console.log(`      ${i + 1}. [${commit.nodeName}] → "${commit.key}"`);
        console.log(`         Namespace: ${commit.namespace}`);
    });
    
    // 4. Metadata Inspection
    console.log('\n4️⃣  Automatic Metadata Injection');
    console.log('─'.repeat(80));
    const sampleKey = mainFlow.backpack.keys()[0];
    const sampleItem = mainFlow.backpack.getItem(sampleKey);
    if (sampleItem) {
        console.log(`   Example: "${sampleKey}"`);
        console.log(`   ┌─ Metadata (auto-injected):`);
        console.log(`   ├─ Source Node: ${sampleItem.metadata.sourceNodeName}`);
        console.log(`   ├─ Node ID: ${sampleItem.metadata.sourceNodeId}`);
        console.log(`   ├─ Namespace: ${sampleItem.metadata.sourceNamespace}`);
        console.log(`   ├─ Version: ${sampleItem.metadata.version}`);
        console.log(`   └─ Timestamp: ${new Date(sampleItem.metadata.timestamp).toLocaleTimeString()}`);
    }
    
    // 5. Access Control
    console.log('\n5️⃣  Access Control (Security)');
    console.log('─'.repeat(80));
    const permissions = mainFlow.backpack.getPermissions();
    console.log(`   🔒 Permission sets: ${permissions.size}`);
    permissions.forEach((perms, nodeId) => {
        console.log(`   • ${nodeId}:`);
        if (perms.read) console.log(`     Read: ${perms.read.length} keys`);
        if (perms.write) console.log(`     Write: ${perms.write.length} keys`);
        if (perms.namespaceRead) console.log(`     Namespace Read: ${perms.namespaceRead.join(', ')}`);
    });
    
    // 6. Time-Travel Debugging
    console.log('\n6️⃣  Time-Travel & Snapshots');
    console.log('─'.repeat(80));
    const snapshot = mainFlow.backpack.toJSON();
    console.log(`   📸 Current snapshot:`);
    console.log(`      • Items: ${snapshot.items.length}`);
    console.log(`      • History: ${snapshot.history.length} commits`);
    console.log(`      • Permissions: ${Object.keys(snapshot.permissions).length} sets`);
    
    if (history.length > 2) {
        const midPoint = history[Math.floor(history.length / 2)];
        const pastSnapshot = mainFlow.backpack.getSnapshotAtCommit(midPoint.commitId);
        console.log(`\n   ⏪ Time-travel to commit ${midPoint.commitId.slice(0, 8)}:`);
        console.log(`      Past state: ${pastSnapshot.size()} items`);
        console.log(`      Current state: ${mainFlow.backpack.size()} items`);
        console.log(`      Difference: +${mainFlow.backpack.size() - pastSnapshot.size()} items`);
    }
    
    // 7. Final Result
    console.log('\n7️⃣  Agent Output');
    console.log('─'.repeat(80));
    const finalSynthesis = mainFlow.backpack.unpack('finalSynthesis');
    const directAnswerData = mainFlow.backpack.unpack('directAnswer');
    
    if (finalSynthesis) {
        console.log(`   ✅ Research Complete`);
        console.log(`   📝 ${finalSynthesis.summary}`);
        console.log(`   📚 Sources analyzed: ${finalSynthesis.sourcesAnalyzed}`);
        console.log(`   🎯 Confidence: ${(finalSynthesis.confidence * 100).toFixed(0)}%`);
        console.log(`\n   Key findings:`);
        finalSynthesis.keyFindings.slice(0, 2).forEach((finding: any, i: number) => {
            console.log(`   ${i + 1}. ${finding.source}`);
            console.log(`      "${finding.insight}"`);
        });
    } else if (directAnswerData) {
        console.log(`   ✅ Direct Answer`);
        console.log(`   💬 ${directAnswerData.response}`);
        console.log(`   🎯 Confidence: ${(directAnswerData.confidence * 100).toFixed(0)}%`);
    }
    
    // 8. Statistics
    console.log('\n8️⃣  Flow Statistics');
    console.log('─'.repeat(80));
    const stats = mainFlow.getStats();
    console.log(`   📊 Main flow nodes: ${stats.nodeCount}`);
    console.log(`   💾 Total items in Backpack: ${stats.backpackSize}`);
    console.log(`   📜 History length: ${history.length} commits`);
    console.log(`   📂 Unique namespaces: ${namespaces.length}`);
    console.log(`   🔒 Access control: Enabled ✅`);
    
    console.log('\n' + '═'.repeat(80));
    console.log('✨ All v2.0 Features Demonstrated!');
    console.log('═'.repeat(80));
    
    console.log('\n📚 What You Just Saw:\n');
    console.log('   ✅ Nested Flow Pattern    → Agent with internal workflow');
    console.log('   ✅ Namespace Composition  → Automatic hierarchical paths');
    console.log('   ✅ Metadata Injection     → Auto nodeId, nodeName, namespace');
    console.log('   ✅ Access Control         → Permissions between nodes');
    console.log('   ✅ Namespace Queries      → Filter by patterns (*.research.*)');
    console.log('   ✅ Execution History      → Complete audit trail');
    console.log('   ✅ Time-Travel Debug      → Snapshots at any commit');
    console.log('   ✅ State Management       → Backpack with full traceability');
    
    console.log('\n🎓 Key Architecture Patterns:\n');
    console.log('   • BackpackNode extends BaseNode');
    console.log('   • Flow composes namespaces: parent.child');
    console.log('   • Agents contain internal flows');
    console.log('   • Shared Backpack across all nodes');
    console.log('   • All operations are traced & debuggable\n');
    
    return mainFlow;
}

// ===== CLI =====

async function main() {
    const args = process.argv.slice(2);
    const userQuery = args.length > 0 
        ? args.join(' ')
        : 'search for machine learning best practices';
    
    try {
        await runDemo(userQuery);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { runDemo, ResearchAgentNode };
