#!/usr/bin/env npx tsx

/**
 * Storage Capabilities Demo
 * 
 * This shows how the new capability-based storage system works
 * and how it enables reusable nodes across different applications.
 */

import { 
    BaseStorage, 
    ResearchStorage, 
    SearchCapable, 
    ChatCapable, 
    DecisionCapable,
    SimpleChatStorage,
    createStorage, 
    updateStorage,
    hasCapability 
} from 'backpackflow/storage/capabilities';

// ============================================================================
// EXAMPLE 1: Research Agent Storage
// ============================================================================

console.log('🔬 Research Agent Storage Example');
console.log('='.repeat(50));

// Create research storage directly
const researchStorage: ResearchStorage = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    _flowState: { executionPath: [] },
    
    search: {
        query: "What is the capital of France?",
        results: [],
        config: { maxResults: 5, sources: ['web'] }
    },
    chat: {
        messages: [
            { role: 'user' as const, content: 'What is the capital of France?', timestamp: new Date() }
        ],
        context: "User asking about geography"
    },
    decisions: {
        availableActions: ['search', 'answer'],
        history: []
    }
};

console.log('Initial Research Storage:');
console.log(JSON.stringify(researchStorage, null, 2));

// ============================================================================
// EXAMPLE 2: Reusable Nodes with Capabilities
// ============================================================================

console.log('\n\n🔧 Reusable Nodes Example');
console.log('='.repeat(50));

// Generic search node that works with ANY storage that has SearchCapable
class GenericSearchNode<T extends BaseStorage & SearchCapable> {
    
    async prep(shared: T): Promise<string> {
        // Works with any storage that has search capability
        return shared.search?.query || "default query";
    }
    
    async exec(query: string): Promise<string> {
        // Simulate search
        return `Search results for: ${query}\n- Result 1: Paris is the capital of France\n- Result 2: Paris population is 2.1 million`;
    }
    
    async post(shared: T, prepRes: unknown, execRes: unknown): Promise<string> {
        // Update search results in storage
        if (!shared.search) shared.search = { results: [] };
        if (!shared.search.results) shared.search.results = [];
        
        shared.search.results.push({
            source: 'web',
            content: execRes as string,
            timestamp: new Date()
        });
        
        updateStorage(shared, {}, 'GenericSearchNode');
        return 'continue';
    }
}

// Generic decision node that works with ANY storage that has DecisionCapable
class GenericDecisionNode<T extends BaseStorage & DecisionCapable & SearchCapable> {
    
    async prep(shared: T): Promise<{ hasResults: boolean; query: string }> {
        const hasResults = (shared.search?.results?.length || 0) > 0;
        const query = shared.search?.query || "";
        return { hasResults, query };
    }
    
    async exec(input: { hasResults: boolean; query: string }): Promise<string> {
        // Simple decision logic
        if (input.hasResults) {
            return 'answer';
        } else {
            return 'search';
        }
    }
    
    async post(shared: T, prepRes: unknown, execRes: unknown): Promise<string> {
        const decision = execRes as string;
        
        // Record the decision
        if (!shared.decisions) shared.decisions = { history: [] };
        if (!shared.decisions.history) shared.decisions.history = [];
        
        shared.decisions.current = {
            action: decision,
            reasoning: decision === 'search' ? 'No search results found' : 'Have search results',
            confidence: 0.9
        };
        
        shared.decisions.history.push({
            decision,
            reasoning: shared.decisions.current.reasoning,
            timestamp: new Date(),
            confidence: 0.9
        });
        
        updateStorage(shared, {}, 'GenericDecisionNode');
        return decision;
    }
}

async function demonstrateReusableNodes() {
    // Test the reusable nodes
    const searchNode = new GenericSearchNode<ResearchStorage>();
    const decisionNode = new GenericDecisionNode<ResearchStorage>();

    console.log('\n1. Before Search Decision:');
    const decision1 = await decisionNode.prep(researchStorage);
    const action1 = await decisionNode.exec(decision1);
    await decisionNode.post(researchStorage, decision1, action1);
    console.log(`Decision: ${action1} (${researchStorage.decisions?.current?.reasoning})`);

    console.log('\n2. After Running Search:');
    const searchQuery = await searchNode.prep(researchStorage);
    const searchResults = await searchNode.exec(searchQuery);
    await searchNode.post(researchStorage, searchQuery, searchResults);
    console.log(`Search completed. Found ${researchStorage.search?.results?.length} results`);

    console.log('\n3. After Search Decision:');
    const decision2 = await decisionNode.prep(researchStorage);
    const action2 = await decisionNode.exec(decision2);
    await decisionNode.post(researchStorage, decision2, action2);
    console.log(`Decision: ${action2} (${researchStorage.decisions?.current?.reasoning})`);
}

// ============================================================================
// EXAMPLE 3: Different Storage Types Using Same Nodes
// ============================================================================

console.log('\n\n🎯 Cross-Application Reusability');
console.log('='.repeat(50));

// Email application storage - completely different structure but uses same capabilities
interface EmailStorage extends BaseStorage, SearchCapable, ChatCapable {
    // Email-specific data
    emails?: Array<{ id: string; subject: string; body: string; from: string }>;
    currentDraft?: { subject: string; body: string };
}

// Create email storage directly from the interface
const emailStorage: EmailStorage = {
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
    _flowState: { executionPath: [] },
    
    emails: [
        { id: '1', subject: 'Meeting Tomorrow', body: 'Reminder about...', from: 'boss@company.com' }
    ],
    search: {
        query: "find emails about meetings",
        results: [],
        config: { maxResults: 10, sources: ['inbox', 'sent'] }
    },
    chat: {
        messages: [
            { role: 'system' as const, content: 'You are an email assistant' },
            { role: 'user' as const, content: 'Find emails about meetings' }
        ]
    }
};

console.log('\nEmail Storage (different app, same capabilities):');
console.log(`- Has emails: ${emailStorage.emails?.length} emails`);
console.log(`- Search query: "${emailStorage.search?.query}"`);
console.log(`- Chat messages: ${emailStorage.chat?.messages.length} messages`);

async function demonstrateCrossAppReusability() {
    // THE SAME search node works with email storage!
    const emailSearchNode = new GenericSearchNode<EmailStorage>();
    console.log('\n🎉 Same SearchNode works with EmailStorage!');

    const emailQuery = await emailSearchNode.prep(emailStorage);
    const emailResults = await emailSearchNode.exec(emailQuery);
    await emailSearchNode.post(emailStorage, emailQuery, emailResults);

    console.log(`Search completed for email app. Found ${emailStorage.search?.results?.length} results`);
}

// ============================================================================
// EXAMPLE 4: Capability Checking
// ============================================================================

console.log('\n\n🔍 Capability Checking');
console.log('='.repeat(50));

console.log('Research Storage Capabilities:');
console.log(`- Search: ${hasCapability(researchStorage, 'search')}`);
console.log(`- Chat: ${hasCapability(researchStorage, 'chat')}`);
console.log(`- Decisions: ${hasCapability(researchStorage, 'decisions')}`);
console.log(`- Documents: ${hasCapability(researchStorage, 'documents')}`);

console.log('\nEmail Storage Capabilities:');
console.log(`- Search: ${hasCapability(emailStorage, 'search')}`);
console.log(`- Chat: ${hasCapability(emailStorage, 'chat')}`);
console.log(`- Decisions: ${hasCapability(emailStorage, 'decisions')}`);
console.log(`- Documents: ${hasCapability(emailStorage, 'documents')}`);

async function main() {
    await demonstrateReusableNodes();
    await demonstrateCrossAppReusability();
    
    console.log('\n✅ Demo Complete! Key Benefits:');
    console.log('1. 🔄 Same nodes work across different applications');
    console.log('2. 🧩 Mix and match capabilities as needed');  
    console.log('3. 🎯 Type-safe capability checking');
    console.log('4. 📦 Build reusable node libraries');
    console.log('5. 🏗️ Storage stays central (PocketFlow strength)');
}

// Run the demo
if (require.main === module) {
    main().catch(console.error);
}

// No need to export implementation classes anymore!
