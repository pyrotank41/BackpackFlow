/**
 * BackpackFlow Phase 6 Tests - Integration & Polish
 * 
 * End-to-end integration tests covering:
 * - Real multi-agent workflows
 * - Serialization with namespaces
 * - Performance validation
 * - Error handling and edge cases
 * - Cross-feature integration
 * 
 * Based on TECH-SPEC-001 §9: Phase 6 - Integration & Polish
 */

import { Backpack } from '../../src/storage/backpack';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { Flow } from '../../src/flows/flow';

// ===== Test Nodes for Integration Scenarios =====

class ChatNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    async prep(shared: any): Promise<any> {
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        const userQuery = prepRes?.query || this.unpack('userQuery') || 'default query';
        this.pack('chatInput', userQuery);
        this.pack('conversationHistory', [
            { role: 'user', content: userQuery }
        ]);
        return { needsSearch: userQuery.includes('search') };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return execRes.needsSearch ? 'needs_search' : 'direct_answer';
    }
}

class SearchNode extends BackpackNode {
    static namespaceSegment = "search";
    
    async exec(prepRes: any): Promise<any> {
        const query = this.unpack('chatInput');
        const results = [`Result for: ${query}`, 'Additional context'];
        this.pack('searchResults', results);
        return { results };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return 'summarize';
    }
}

class SummaryNode extends BackpackNode {
    static namespaceSegment = "summary";
    
    async exec(prepRes: any): Promise<any> {
        const results = this.unpack('searchResults') || [];
        const history = this.unpack('conversationHistory') || [];
        const summary = `Summary: ${results.length} results found`;
        this.pack('finalSummary', summary);
        return { summary };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return 'default'; // Continue to next node
    }
}

class DecisionNode extends BackpackNode {
    static namespaceSegment = "decision";
    
    async exec(prepRes: any): Promise<any> {
        const summary = this.unpack('finalSummary');
        this.pack('decision', { action: 'complete', summary });
        return { action: 'complete' };
    }
}

// Agent node with internal flow
class ResearchAgentNode extends BackpackNode {
    static namespaceSegment = "researchAgent";
    
    async prep(shared: any): Promise<any> {
        return shared;
    }
    
    async exec(prepRes: any): Promise<any> {
        // Create internal flow
        const internalFlow = new Flow({
            namespace: this.namespace,
            backpack: this.backpack
        });
        
        // Build internal pipeline
        const chat = internalFlow.addNode(ChatNode, { id: 'chat' });
        const search = internalFlow.addNode(SearchNode, { id: 'search' });
        const summary = internalFlow.addNode(SummaryNode, { id: 'summary' });
        
        // Wire up
        chat.on('needs_search', search);
        chat.on('direct_answer', summary);
        search.on('summarize', summary);
        
        // Run
        await internalFlow.run(chat, prepRes);
        
        return { completed: true };
    }
}

describe('BackpackFlow - Phase 6: Integration & Polish', () => {
    
    describe('End-to-End: Simple Chat Pipeline', () => {
        it('should execute complete chat → search → summary flow', async () => {
            const flow = new Flow({ namespace: 'customer-support' });
            
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            const search = flow.addNode(SearchNode, { id: 'search' });
            const summary = flow.addNode(SummaryNode, { id: 'summary' });
            
            chat.on('needs_search', search);
            chat.on('direct_answer', summary);
            search.on('summarize', summary);
            
            await flow.run(chat, { query: 'search for documentation' });
            
            // Verify all nodes executed
            expect(flow.backpack.has('chatInput')).toBe(true);
            expect(flow.backpack.has('searchResults')).toBe(true);
            expect(flow.backpack.has('finalSummary')).toBe(true);
            
            // Verify namespaces
            expect(flow.backpack.getItem('chatInput')!.metadata.sourceNamespace)
                .toBe('customer-support.chat');
            expect(flow.backpack.getItem('searchResults')!.metadata.sourceNamespace)
                .toBe('customer-support.search');
            expect(flow.backpack.getItem('finalSummary')!.metadata.sourceNamespace)
                .toBe('customer-support.summary');
        });
        
        it('should handle direct answer path (no search)', async () => {
            const flow = new Flow({ namespace: 'customer-support' });
            
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            const summary = flow.addNode(SummaryNode, { id: 'summary' });
            
            chat.on('direct_answer', summary);
            
            await flow.run(chat, { query: 'hello' });
            
            // Should have chat and summary, but no search
            expect(flow.backpack.has('chatInput')).toBe(true);
            expect(flow.backpack.has('searchResults')).toBe(false);
            expect(flow.backpack.has('finalSummary')).toBe(true);
        });
    });
    
    describe('End-to-End: Multi-Agent System', () => {
        it('should support nested agent with internal flow', async () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
            
            await mainFlow.run(agent, { query: 'search for pricing' });
            
            // Verify hierarchical namespaces
            const namespaces = mainFlow.backpack.getNamespaces();
            
            expect(namespaces).toContain('sales.researchAgent.chat');
            expect(namespaces).toContain('sales.researchAgent.search');
            expect(namespaces).toContain('sales.researchAgent.summary');
        });
        
        it('should maintain data isolation between agents', async () => {
            const flow = new Flow({
                namespace: 'multi-agent',
                backpackOptions: { enableAccessControl: true }
            });
            
            // Agent 1 with permissions
            flow.backpack.registerPermissions('agent1', {
                read: ['agent1-data'],
                write: ['agent1-data'],
                namespaceRead: ['agent1.*'],
                namespaceWrite: ['agent1.*']
            });
            
            // Agent 2 with different permissions
            flow.backpack.registerPermissions('agent2', {
                read: ['agent2-data'],
                write: ['agent2-data'],
                namespaceRead: ['agent2.*'],
                namespaceWrite: ['agent2.*']
            });
            
            // Pack from different agents
            flow.backpack.pack('agent1-data', 'secret1', {
                nodeId: 'agent1',
                namespace: 'agent1.internal'
            });
            
            flow.backpack.pack('agent2-data', 'secret2', {
                nodeId: 'agent2',
                namespace: 'agent2.internal'
            });
            
            // Verify isolation
            expect(flow.backpack.unpack('agent1-data', 'agent1')).toBe('secret1');
            expect(flow.backpack.unpack('agent2-data', 'agent2')).toBe('secret2');
            
            // Cross-agent access should fail
            expect(flow.backpack.unpack('agent1-data', 'agent2')).toBeUndefined();
            expect(flow.backpack.unpack('agent2-data', 'agent1')).toBeUndefined();
        });
    });
    
    describe('Serialization Integration', () => {
        it('should serialize and restore complete flow state', async () => {
            const flow = new Flow({ namespace: 'sales' });
            
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            const search = flow.addNode(SearchNode, { id: 'search' });
            
            chat.on('needs_search', search);
            
            await flow.run(chat, { query: 'search for info' });
            
            // Serialize
            const snapshot = flow.backpack.toJSON();
            
            // Restore
            const restoredBackpack = Backpack.fromJSON(snapshot);
            
            // Verify all data restored
            expect(restoredBackpack.has('chatInput')).toBe(true);
            expect(restoredBackpack.has('searchResults')).toBe(true);
            
            // Verify namespaces preserved
            expect(restoredBackpack.getItem('chatInput')!.metadata.sourceNamespace)
                .toBe('sales.chat');
        });
        
        it('should preserve history across serialization', async () => {
            const backpack = new Backpack();
            
            backpack.pack('key1', 'value1', { nodeId: 'node1', namespace: 'test.node1' });
            backpack.pack('key2', 'value2', { nodeId: 'node2', namespace: 'test.node2' });
            backpack.pack('key1', 'updated', { nodeId: 'node1', namespace: 'test.node1' });
            
            const history = backpack.getHistory();
            
            // Serialize and restore
            const snapshot = backpack.toJSON();
            const restored = Backpack.fromJSON(snapshot);
            
            const restoredHistory = restored.getHistory();
            
            expect(restoredHistory).toHaveLength(history.length);
            expect(restoredHistory[0].key).toBe(history[0].key);
            expect(restoredHistory[0].namespace).toBe(history[0].namespace);
        });
        
        it('should preserve permissions across serialization', async () => {
            const backpack = new Backpack(undefined, { enableAccessControl: true });
            
            backpack.registerPermissions('node1', {
                read: ['key1'],
                namespaceRead: ['test.*']
            });
            
            // Serialize and restore
            const snapshot = backpack.toJSON();
            const restored = Backpack.fromJSON(snapshot);
            
            const permissions = restored.getPermissions();
            
            expect(permissions.has('node1')).toBe(true);
            expect(permissions.get('node1')!.read).toContain('key1');
        });
    });
    
    describe('Performance Validation', () => {
        it('should pack() in < 1ms', () => {
            const backpack = new Backpack();
            
            const start = performance.now();
            backpack.pack('test', 'value', { nodeId: 'node1', namespace: 'test' });
            const elapsed = performance.now() - start;
            
            expect(elapsed).toBeLessThan(1);
        });
        
        it('should unpack() in < 0.5ms', () => {
            const backpack = new Backpack();
            backpack.pack('test', 'value');
            
            const start = performance.now();
            backpack.unpack('test');
            const elapsed = performance.now() - start;
            
            expect(elapsed).toBeLessThan(0.5);
        });
        
        it('should handle 1000 pack operations efficiently', () => {
            const backpack = new Backpack();
            
            const start = performance.now();
            for (let i = 0; i < 1000; i++) {
                backpack.pack(`key-${i}`, `value-${i}`, {
                    nodeId: `node-${i % 10}`,
                    namespace: `test.node${i % 10}`
                });
            }
            const elapsed = performance.now() - start;
            
            // Should complete in < 1000ms (1ms per operation)
            expect(elapsed).toBeLessThan(1000);
            expect(backpack.size()).toBe(1000);
        });
        
        it('should query by namespace efficiently for 1000 items', () => {
            const backpack = new Backpack();
            
            // Pack 1000 items across 10 namespaces
            for (let i = 0; i < 1000; i++) {
                backpack.pack(`key-${i}`, `value-${i}`, {
                    nodeId: 'node',
                    namespace: `category-${i % 10}.sub`
                });
            }
            
            const start = performance.now();
            const results = backpack.unpackByNamespace('category-5.*');
            const elapsed = performance.now() - start;
            
            // Should complete in < 50ms (relaxed for CI environments)
            expect(elapsed).toBeLessThan(50);
            expect(Object.keys(results)).toHaveLength(100);
        });
        
        it('should handle large history without memory issues', () => {
            const backpack = new Backpack(undefined, { maxHistorySize: 10000 });
            
            // Pack 15000 items (exceeds max history)
            for (let i = 0; i < 15000; i++) {
                backpack.pack(`key-${i % 100}`, `value-${i}`, {
                    nodeId: 'node',
                    namespace: 'test'
                });
            }
            
            const history = backpack.getHistory();
            
            // Should be capped at maxHistorySize
            expect(history.length).toBeLessThanOrEqual(10000);
        });
    });
    
    describe('Error Handling & Edge Cases', () => {
        it('should handle circular references gracefully', () => {
            const backpack = new Backpack();
            
            const circular: any = { name: 'test' };
            circular.self = circular;
            
            // Should not throw, but valueSummary might be limited
            expect(() => {
                backpack.pack('circular', circular, { nodeId: 'node1' });
            }).not.toThrow();
            
            // Should be able to retrieve
            const retrieved = backpack.unpack('circular');
            expect(retrieved).toBeDefined();
        });
        
        it('should handle undefined and null values', () => {
            const backpack = new Backpack();
            
            backpack.pack('undefined', undefined);
            backpack.pack('null', null);
            
            expect(backpack.has('undefined')).toBe(true);
            expect(backpack.has('null')).toBe(true);
            expect(backpack.unpack('undefined')).toBeUndefined();
            expect(backpack.unpack('null')).toBeNull();
        });
        
        it('should handle empty strings and empty objects', () => {
            const backpack = new Backpack();
            
            backpack.pack('emptyString', '');
            backpack.pack('emptyObject', {});
            backpack.pack('emptyArray', []);
            
            expect(backpack.unpack('emptyString')).toBe('');
            expect(backpack.unpack('emptyObject')).toEqual({});
            expect(backpack.unpack('emptyArray')).toEqual([]);
        });
        
        it('should handle special characters in keys', () => {
            const backpack = new Backpack();
            
            backpack.pack('key-with-dashes', 'value1');
            backpack.pack('key.with.dots', 'value2');
            backpack.pack('key_with_underscores', 'value3');
            backpack.pack('key:with:colons', 'value4');
            
            expect(backpack.unpack('key-with-dashes')).toBe('value1');
            expect(backpack.unpack('key.with.dots')).toBe('value2');
            expect(backpack.unpack('key_with_underscores')).toBe('value3');
            expect(backpack.unpack('key:with:colons')).toBe('value4');
        });
        
        it('should handle very long keys', () => {
            const backpack = new Backpack();
            const longKey = 'a'.repeat(1000);
            
            backpack.pack(longKey, 'value');
            
            expect(backpack.has(longKey)).toBe(true);
            expect(backpack.unpack(longKey)).toBe('value');
        });
        
        it('should handle large values', () => {
            const backpack = new Backpack();
            const largeValue = 'x'.repeat(100000); // 100KB string
            
            backpack.pack('large', largeValue);
            
            expect(backpack.unpack('large')).toBe(largeValue);
        });
    });
    
    describe('Cross-Feature Integration', () => {
        it('should integrate history + namespaces + access control', async () => {
            const flow = new Flow({
                namespace: 'sales',
                backpackOptions: { enableAccessControl: true }
            });
            
            // Setup permissions
            flow.backpack.registerPermissions('chat', {
                read: ['userQuery', 'chatInput', 'conversationHistory'],
                write: ['chatInput', 'conversationHistory'],
                namespaceRead: ['sales.*']
            });
            
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            
            // Pack initial data
            flow.backpack.pack('userQuery', 'test query');
            
            // Run node
            await flow.run(chat, { query: 'test' });
            
            // Verify history was recorded
            const history = flow.backpack.getHistory();
            expect(history.length).toBeGreaterThan(0);
            
            // Verify data was packed with namespace
            const chatInput = flow.backpack.getItem('chatInput');
            expect(chatInput).toBeDefined();
            expect(chatInput!.metadata.sourceNamespace).toBe('sales.chat');
            
            // Verify access control works with namespaces
            const salesData = flow.backpack.unpackByNamespace('sales.*', 'chat');
            expect(Object.keys(salesData).length).toBeGreaterThan(0);
        });
        
        it('should support time-travel with namespaces', async () => {
            const flow = new Flow({ namespace: 'test' });
            
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            const search = flow.addNode(SearchNode, { id: 'search' });
            
            chat.on('needs_search', search);
            
            await flow.run(chat, { query: 'search test' });
            
            // Get history
            const history = flow.backpack.getHistory();
            
            // Find commit before search
            const beforeSearch = history.find(h => 
                h.key === 'chatInput' && h.action === 'pack'
            );
            
            if (beforeSearch) {
                // Get snapshot before search
                const snapshot = flow.backpack.getSnapshotAtCommit(beforeSearch.commitId);
                
                // Should have chat data but not search data
                expect(snapshot.has('chatInput')).toBe(true);
                expect(snapshot.has('searchResults')).toBe(false);
            }
        });
        
        it('should support complex multi-level namespace queries', () => {
            const backpack = new Backpack();
            
            // Create complex hierarchy
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'app.v1.sales.chat' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'app.v1.sales.search' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'app.v1.support.chat' });
            backpack.pack('d', '4', { nodeId: 'x', namespace: 'app.v2.sales.chat' });
            
            // Query patterns
            const allNamespaces = backpack.getNamespaces();
            expect(allNamespaces).toHaveLength(4);
            
            // Can query by specific segments (single wildcard matches one level)
            const v1SalesChat = backpack.getItemsByNamespace('*.v1.sales.chat');
            const v2SalesChat = backpack.getItemsByNamespace('*.v2.sales.chat');
            const appV1Sales = backpack.getItemsByNamespace('app.v1.sales.*');
            
            // Verify results
            expect(v1SalesChat.length).toBe(1); // app.v1.sales.chat
            expect(v2SalesChat.length).toBe(1); // app.v2.sales.chat
            expect(appV1Sales.length).toBe(2); // app.v1.sales.chat + app.v1.sales.search
        });
    });
    
    describe('Real-World Scenario: Customer Support Agent', () => {
        it('should handle complete customer support workflow', async () => {
            const flow = new Flow({ namespace: 'customer-support' });
            
            // Build pipeline
            const chat = flow.addNode(ChatNode, { id: 'chat' });
            const search = flow.addNode(SearchNode, { id: 'search' });
            const summary = flow.addNode(SummaryNode, { id: 'summary' });
            const decision = flow.addNode(DecisionNode, { id: 'decision' });
            
            // Wire up
            chat.on('needs_search', search);
            chat.on('direct_answer', summary);
            search.on('summarize', summary);
            summary.on('default', decision);
            
            // Run workflow
            await flow.run(chat, { query: 'search for my order status' });
            
            // Verify complete execution
            expect(flow.backpack.has('chatInput')).toBe(true);
            expect(flow.backpack.has('searchResults')).toBe(true);
            expect(flow.backpack.has('finalSummary')).toBe(true);
            expect(flow.backpack.has('decision')).toBe(true);
            
            // Verify namespaces are correct
            const namespaces = flow.backpack.getNamespaces();
            expect(namespaces).toContain('customer-support.chat');
            expect(namespaces).toContain('customer-support.search');
            expect(namespaces).toContain('customer-support.summary');
            expect(namespaces).toContain('customer-support.decision');
            
            // Verify we can trace the execution
            const history = flow.backpack.getHistory();
            const executionOrder = history
                .filter(h => h.action === 'pack')
                .map(h => h.namespace);
            
            expect(executionOrder.length).toBeGreaterThan(0);
            
            // Get final stats
            const stats = flow.getStats();
            expect(stats.nodeCount).toBe(4);
            expect(stats.backpackSize).toBeGreaterThan(0);
        });
    });
});

