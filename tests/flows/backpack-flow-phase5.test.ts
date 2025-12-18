/**
 * BackpackFlow Phase 5 Tests - Graph-Assigned Namespaces
 * 
 * Tests for:
 * - BackpackNode instantiation and lifecycle
 * - Flow namespace composition
 * - Automatic metadata injection
 * - Nested flows/subgraphs
 * - Node helper methods
 * - Integration scenarios
 * 
 * Based on TECH-SPEC-001 §4: BackpackNode & Flow Classes
 */

import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { Flow } from '../../src/flows/flow';
import { Backpack } from '../../src/storage/backpack';

// Test Nodes
class TestChatNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    async exec(input: any): Promise<any> {
        this.pack('chatInput', input);
        return { message: 'Hello from chat' };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        this.pack('chatOutput', execRes);
        return 'next_action';
    }
}

class TestSearchNode extends BackpackNode {
    static namespaceSegment = "search";
    
    async exec(input: any): Promise<any> {
        const query = this.unpack('chatInput');
        this.pack('searchResults', ['result1', 'result2']);
        return { results: ['result1', 'result2'] };
    }
    
    async post(shared: any, prepRes: any, execRes: any): Promise<string | undefined> {
        return 'default'; // Continue to next node
    }
}

class TestSummaryNode extends BackpackNode {
    static namespaceSegment = "summary";
    
    async exec(input: any): Promise<any> {
        const results = this.unpack('searchResults');
        this.pack('summary', 'Summary of results');
        return { summary: 'Summary of results' };
    }
}

// Test node without static namespaceSegment (should use ID)
class GenericNode extends BackpackNode {
    async exec(input: any): Promise<any> {
        return { generic: true };
    }
}

describe('BackpackFlow - Phase 5: Graph-Assigned Namespaces', () => {
    
    describe('BackpackNode Instantiation', () => {
        let backpack: Backpack;
        let context: NodeContext;
        
        beforeEach(() => {
            backpack = new Backpack();
            context = {
                namespace: 'test.node',
                backpack,
                eventStreamer: undefined
            };
        });
        
        it('should create node with proper context', () => {
            const node = new TestChatNode({ id: 'chat-1' }, context);
            
            expect(node.id).toBe('chat-1');
            expect(node.namespace).toBe('test.node');
        });
        
        it('should have access to backpack', () => {
            const node = new TestChatNode({ id: 'chat-1' }, context);
            
            // Should be able to pack
            (node as any).pack('test', 'value');
            
            expect(backpack.has('test')).toBe(true);
        });
        
        it('should support namespaceSegment static property', () => {
            expect(TestChatNode.namespaceSegment).toBe('chat');
            expect(TestSearchNode.namespaceSegment).toBe('search');
        });
        
        it('should work without namespaceSegment', () => {
            const node = new GenericNode({ id: 'generic-1' }, context);
            
            expect(node.id).toBe('generic-1');
            expect(node.namespace).toBe('test.node');
        });
    });
    
    describe('Flow Namespace Composition', () => {
        it('should create flow with namespace', () => {
            const flow = new Flow({ namespace: 'sales' });
            
            expect(flow.namespace).toBe('sales');
        });
        
        it('should create flow without namespace (empty string)', () => {
            const flow = new Flow();
            
            expect(flow.namespace).toBe('');
        });
        
        it('should compose namespace for nodes', () => {
            const flow = new Flow({ namespace: 'sales' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            // Composed: sales + chat = sales.chat
            expect(node.namespace).toBe('sales.chat');
        });
        
        it('should use node ID when namespaceSegment is missing', () => {
            const flow = new Flow({ namespace: 'sales' });
            const node = flow.addNode(GenericNode, { id: 'custom-node' });
            
            // Composed: sales + custom-node = sales.custom-node
            expect(node.namespace).toBe('sales.custom-node');
        });
        
        it('should handle empty flow namespace', () => {
            const flow = new Flow();
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            // No parent namespace, just segment
            expect(node.namespace).toBe('chat');
        });
        
        it('should compose multi-level namespaces', () => {
            const flow = new Flow({ namespace: 'app.v1.sales' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            expect(node.namespace).toBe('app.v1.sales.chat');
        });
    });
    
    describe('Flow Node Management', () => {
        let flow: Flow;
        
        beforeEach(() => {
            flow = new Flow({ namespace: 'test' });
        });
        
        it('should register nodes in flow', () => {
            flow.addNode(TestChatNode, { id: 'chat' });
            flow.addNode(TestSearchNode, { id: 'search' });
            
            expect(flow.getNode('chat')).toBeDefined();
            expect(flow.getNode('search')).toBeDefined();
        });
        
        it('should return undefined for non-existent node', () => {
            expect(flow.getNode('nonexistent')).toBeUndefined();
        });
        
        it('should get all nodes', () => {
            flow.addNode(TestChatNode, { id: 'chat' });
            flow.addNode(TestSearchNode, { id: 'search' });
            
            const nodes = flow.getAllNodes();
            
            expect(nodes).toHaveLength(2);
        });
        
        it('should share backpack across nodes', () => {
            const node1 = flow.addNode(TestChatNode, { id: 'chat' });
            const node2 = flow.addNode(TestSearchNode, { id: 'search' });
            
            // Pack from node1
            (node1 as any).pack('sharedData', 'value');
            
            // Unpack from node2
            const value = (node2 as any).unpack('sharedData');
            
            expect(value).toBe('value');
        });
    });
    
    describe('Automatic Metadata Injection', () => {
        it('should inject metadata on pack()', async () => {
            const flow = new Flow({ namespace: 'sales' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            // Run node (which calls pack)
            await node._run({});
            
            // Check that metadata was injected
            const item = flow.backpack.getItem('chatInput');
            
            expect(item).toBeDefined();
            expect(item!.metadata.sourceNodeId).toBe('chat');
            expect(item!.metadata.sourceNodeName).toBe('TestChatNode');
            expect(item!.metadata.sourceNamespace).toBe('sales.chat');
        });
        
        it('should inject metadata in post()', async () => {
            const flow = new Flow({ namespace: 'sales' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            await node._run({});
            
            const item = flow.backpack.getItem('chatOutput');
            
            expect(item).toBeDefined();
            expect(item!.metadata.sourceNodeId).toBe('chat');
            expect(item!.metadata.sourceNamespace).toBe('sales.chat');
        });
        
        it('should allow metadata overrides', async () => {
            const flow = new Flow({ namespace: 'sales' });
            
            class CustomNode extends BackpackNode {
                static namespaceSegment = "custom";
                
                async exec(input: any): Promise<any> {
                    this.pack('test', 'value', {
                        namespace: 'override.namespace'
                    });
                    return {};
                }
            }
            
            const node = flow.addNode(CustomNode, { id: 'custom' });
            await node._run({});
            
            const item = flow.backpack.getItem('test');
            
            expect(item!.metadata.sourceNamespace).toBe('override.namespace');
        });
    });
    
    describe('Node Helper Methods', () => {
        let flow: Flow;
        let node: TestChatNode;
        
        beforeEach(() => {
            flow = new Flow({ namespace: 'test' });
            node = flow.addNode(TestChatNode, { id: 'chat' });
        });
        
        it('should pack using helper method', () => {
            (node as any).pack('test', 'value');
            
            expect(flow.backpack.has('test')).toBe(true);
            expect(flow.backpack.unpack('test')).toBe('value');
        });
        
        it('should unpack using helper method', () => {
            flow.backpack.pack('test', 'value');
            
            const result = (node as any).unpack('test');
            
            expect(result).toBe('value');
        });
        
        it('should unpack undefined for missing keys', () => {
            const result = (node as any).unpack('nonexistent');
            
            expect(result).toBeUndefined();
        });
        
        it('should unpackRequired and throw for missing keys', () => {
            expect(() => {
                (node as any).unpackRequired('nonexistent');
            }).toThrow();
        });
        
        it('should unpackByNamespace using helper method', () => {
            flow.backpack.pack('a', '1', { nodeId: 'x', namespace: 'test.chat' });
            flow.backpack.pack('b', '2', { nodeId: 'x', namespace: 'test.search' });
            
            const result = (node as any).unpackByNamespace('test.*');
            
            expect(result).toHaveProperty('a');
            expect(result).toHaveProperty('b');
        });
    });
    
    describe('Nested Flows/Subgraphs', () => {
        it('should create subflow with composed namespace', () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const subflow = mainFlow.createSubflow({ namespace: 'agent' });
            
            expect(subflow.namespace).toBe('sales.agent');
        });
        
        it('should share backpack with subflow', () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const subflow = mainFlow.createSubflow({ namespace: 'agent' });
            
            // Pack in main flow
            mainFlow.backpack.pack('shared', 'data');
            
            // Access from subflow
            const value = subflow.backpack.unpack('shared');
            
            expect(value).toBe('data');
            expect(subflow.backpack).toBe(mainFlow.backpack);
        });
        
        it('should compose nested namespaces in subflow', () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const subflow = mainFlow.createSubflow({ namespace: 'agent' });
            const node = subflow.addNode(TestChatNode, { id: 'chat' });
            
            // Composed: sales.agent + chat = sales.agent.chat
            expect(node.namespace).toBe('sales.agent.chat');
        });
        
        it('should support deeply nested flows', () => {
            const l1 = new Flow({ namespace: 'app' });
            const l2 = l1.createSubflow({ namespace: 'v1' });
            const l3 = l2.createSubflow({ namespace: 'sales' });
            const node = l3.addNode(TestChatNode, { id: 'chat' });
            
            expect(node.namespace).toBe('app.v1.sales.chat');
        });
    });
    
    describe('Flow Execution', () => {
        it('should run a single node', async () => {
            const flow = new Flow({ namespace: 'test' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            const result = await flow.run(node, { input: 'test' });
            
            expect(result).toBe('next_action');
            expect(flow.backpack.has('chatInput')).toBe(true);
        });
        
        it('should run chained nodes', async () => {
            const flow = new Flow({ namespace: 'test' });
            const chat = flow.addNode(TestChatNode, { id: 'chat' });
            const search = flow.addNode(TestSearchNode, { id: 'search' });
            const summary = flow.addNode(TestSummaryNode, { id: 'summary' });
            
            // Chain: chat → search → summary
            chat.on('next_action', search);
            search.on('default', summary);
            
            await flow.run(chat, {});
            
            expect(flow.backpack.has('chatInput')).toBe(true);
            expect(flow.backpack.has('searchResults')).toBe(true);
            expect(flow.backpack.has('summary')).toBe(true);
        });
        
        it('should set and use entry node', async () => {
            const flow = new Flow({ namespace: 'test' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            flow.setEntryNode(node);
            
            const result = await flow.run({});
            
            expect(result).toBe('next_action');
        });
        
        it('should throw if no entry node set', async () => {
            const flow = new Flow({ namespace: 'test' });
            
            await expect(flow.run({})).rejects.toThrow('No entry node set');
        });
    });
    
    describe('Flow Statistics', () => {
        it('should return flow stats', () => {
            const flow = new Flow({ namespace: 'sales' });
            flow.addNode(TestChatNode, { id: 'chat' });
            flow.addNode(TestSearchNode, { id: 'search' });
            
            flow.backpack.pack('test', 'value');
            
            const stats = flow.getStats();
            
            expect(stats.namespace).toBe('sales');
            expect(stats.nodeCount).toBe(2);
            expect(stats.backpackSize).toBe(1);
            expect(stats.hasEntryNode).toBe(false);
        });
        
        it('should reflect entry node in stats', () => {
            const flow = new Flow({ namespace: 'sales' });
            const node = flow.addNode(TestChatNode, { id: 'chat' });
            
            flow.setEntryNode(node);
            
            const stats = flow.getStats();
            
            expect(stats.hasEntryNode).toBe(true);
        });
    });
    
    describe('Integration: Agent with Internal Flow', () => {
        class ResearchAgentNode extends BackpackNode {
            static namespaceSegment = "researchAgent";
            
            async exec(input: any): Promise<any> {
                // Create internal flow
                const internalFlow = new Flow({
                    namespace: this.namespace,
                    backpack: this.backpack
                });
                
                // Add internal nodes
                const chat = internalFlow.addNode(TestChatNode, { id: 'chat' });
                const search = internalFlow.addNode(TestSearchNode, { id: 'search' });
                
                // Chain them
                chat.on('next_action', search);
                
                // Run internal flow
                await internalFlow.run(chat, input);
                
                return { completed: true };
            }
        }
        
        it('should support agent with internal flow', async () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
            
            await mainFlow.run(agent, { query: 'test' });
            
            // Check namespaces of internal items
            const chatItem = mainFlow.backpack.getItem('chatInput');
            expect(chatItem!.metadata.sourceNamespace).toBe('sales.researchAgent.chat');
            
            const searchItem = mainFlow.backpack.getItem('searchResults');
            expect(searchItem!.metadata.sourceNamespace).toBe('sales.researchAgent.search');
        });
        
        it('should maintain namespace hierarchy', async () => {
            const mainFlow = new Flow({ namespace: 'sales' });
            const agent = mainFlow.addNode(ResearchAgentNode, { id: 'agent' });
            
            await mainFlow.run(agent, {});
            
            const namespaces = mainFlow.backpack.getNamespaces();
            
            expect(namespaces).toContain('sales.researchAgent.chat');
            expect(namespaces).toContain('sales.researchAgent.search');
        });
    });
    
    describe('Access Control Integration', () => {
        it('should enforce permissions in flow', async () => {
            const flow = new Flow({
                namespace: 'test',
                backpackOptions: {
                    enableAccessControl: true
                }
            });
            
            // Register permissions
            flow.backpack.registerPermissions('chat', {
                read: ['input'],
                write: ['output']
            });
            
            class RestrictedNode extends BackpackNode {
                static namespaceSegment = "restricted";
                
                async exec(input: any): Promise<any> {
                    this.pack('output', 'allowed');
                    this.pack('forbidden', 'denied'); // Should fail
                    return {};
                }
            }
            
            const node = flow.addNode(RestrictedNode, { id: 'chat' });
            
            await node._run({});
            
            expect(flow.backpack.has('output')).toBe(true);
            expect(flow.backpack.has('forbidden')).toBe(false); // Denied
        });
    });
});

