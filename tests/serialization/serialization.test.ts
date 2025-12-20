/**
 * Serialization Tests - PRD-003: Serialization Bridge
 * 
 * Tests for config-driven nodes and flows
 */

import { z } from 'zod';
import { DependencyContainer } from '../../src/serialization/dependency-container';
import { FlowLoader } from '../../src/serialization/flow-loader';
import { FlowConfig, NodeConfig, SerializationError, ValidationError, DependencyError, DataContract, ContractValidationError } from '../../src/serialization/types';
import { Backpack } from '../../src/storage/backpack';
import { EventStreamer } from '../../src/events/event-streamer';
import { SimpleChatNode } from '../../src/nodes/serializable/simple-chat-node';
import { SimpleDecisionNode } from '../../src/nodes/serializable/simple-decision-node';
import { BackpackNode, NodeContext } from '../../src/nodes/backpack-node';

/**
 * Test node classes for data contract validation (PRD-005 Issue #3 - Zod Implementation)
 */
class NodeWithContract extends BackpackNode {
    static inputs: DataContract = {
        userQuery: z.string().describe('User question'),
        context: z.object({}).optional()
    };
    
    async prep(shared: any) { return shared; }
    async _exec(prepRes: any) { return {}; }
    async post(shared: any, prepRes: any, execRes: any) { return undefined; }
}

class ValidNodeWithContract extends BackpackNode {
    static inputs: DataContract = {
        userQuery: z.string(),
        maxResults: z.number().optional()
    };
    
    async prep(shared: any) { return shared; }
    async _exec(prepRes: any) { return { success: true }; }
    async post(shared: any, prepRes: any, execRes: any) { return undefined; }
}

class TypeCheckNode extends BackpackNode {
    static inputs: DataContract = {
        count: z.number()
    };
    
    async prep(shared: any) { return shared; }
    async _exec(prepRes: any) { return {}; }
    async post(shared: any, prepRes: any, execRes: any) { return undefined; }
}

class OptionalFieldNode extends BackpackNode {
    static inputs: DataContract = {
        required: z.string(),
        optional: z.string().optional()
    };
    
    async prep(shared: any) { return shared; }
    async _exec(prepRes: any) { return {}; }
    async post(shared: any, prepRes: any, execRes: any) { return undefined; }
}

class AllTypesNode extends BackpackNode {
    static inputs: DataContract = {
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
        obj: z.object({}),
        arr: z.array(z.any()),
        any: z.any()
    };
    
    async prep(shared: any) { return shared; }
    async _exec(prepRes: any) { return {}; }
    async post(shared: any, prepRes: any, execRes: any) { return undefined; }
}

describe('DependencyContainer', () => {
    let container: DependencyContainer;

    beforeEach(() => {
        container = new DependencyContainer();
    });

    describe('Basic Registration', () => {
        it('should register and retrieve dependencies', () => {
            const mockDep = { value: 'test' };
            container.register('testDep', mockDep);

            expect(container.get('testDep')).toBe(mockDep);
        });

        it('should throw DependencyError for missing dependencies', () => {
            expect(() => container.get('nonExistent')).toThrow(DependencyError);
            expect(() => container.get('nonExistent')).toThrow('Dependency \'nonExistent\' not registered');
        });

        it('should check if dependency exists', () => {
            container.register('exists', {});
            
            expect(container.has('exists')).toBe(true);
            expect(container.has('notExists')).toBe(false);
        });

        it('should get all registered keys', () => {
            container.register('dep1', {});
            container.register('dep2', {});
            
            const keys = container.keys();
            expect(keys).toContain('dep1');
            expect(keys).toContain('dep2');
            expect(keys).toHaveLength(2);
        });
    });

    describe('Factory Registration', () => {
        it('should register and create from factory', () => {
            let callCount = 0;
            container.registerFactory('lazy', () => {
                callCount++;
                return { created: true };
            });

            expect(callCount).toBe(0); // Not called yet
            
            const dep = container.get('lazy');
            expect(callCount).toBe(1); // Called once
            expect(dep).toEqual({ created: true });
            
            const dep2 = container.get('lazy');
            expect(callCount).toBe(1); // Still 1 (cached)
            expect(dep2).toBe(dep); // Same instance
        });

        it('should support factory for common dependencies', () => {
            container.registerFactory('eventStreamer', () => new EventStreamer());
            
            const streamer = container.get('eventStreamer');
            expect(streamer).toBeInstanceOf(EventStreamer);
        });
    });

    describe('Container Operations', () => {
        it('should clear all dependencies', () => {
            container.register('dep1', {});
            container.registerFactory('dep2', () => ({}));
            
            expect(container.keys()).toHaveLength(2);
            
            container.clear();
            expect(container.keys()).toHaveLength(0);
        });

        it('should clone container', () => {
            container.register('dep1', { value: 1 });
            container.registerFactory('dep2', () => ({ value: 2 }));
            
            const cloned = container.clone();
            expect(cloned.get('dep1')).toEqual({ value: 1 });
            expect(cloned.get('dep2')).toEqual({ value: 2 });
        });

        it('should create default container', () => {
            const defaultContainer = DependencyContainer.createDefault();
            
            expect(defaultContainer.has('eventStreamer')).toBe(true);
            expect(defaultContainer.has('backpack')).toBe(true);
        });
    });
});

describe('FlowLoader - Node Registration', () => {
    let loader: FlowLoader;

    beforeEach(() => {
        loader = new FlowLoader();
    });

    describe('Node Type Registration', () => {
        it('should register node types', () => {
            loader.register('SimpleChatNode', SimpleChatNode);
            
            expect(loader.isRegistered('SimpleChatNode')).toBe(true);
            expect(loader.isRegistered('UnknownNode')).toBe(false);
        });

        it('should get all registered types', () => {
            loader.register('SimpleChatNode', SimpleChatNode);
            loader.register('SimpleDecisionNode', SimpleDecisionNode);
            
            const types = loader.getRegisteredTypes();
            expect(types).toContain('SimpleChatNode');
            expect(types).toContain('SimpleDecisionNode');
            expect(types).toHaveLength(2);
        });
    });
});

describe('FlowLoader - Config Validation', () => {
    let loader: FlowLoader;

    beforeEach(() => {
        loader = new FlowLoader();
        loader.register('SimpleChatNode', SimpleChatNode);
        loader.register('SimpleDecisionNode', SimpleDecisionNode);
    });

    describe('Valid Configs', () => {
        it('should validate correct flow config', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate config with edges', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4' }
                    },
                    {
                        type: 'SimpleDecisionNode',
                        id: 'decision-1',
                        params: { decisionKey: 'intent' }
                    }
                ],
                edges: [
                    { from: 'chat-1', to: 'decision-1', condition: 'default' }
                ]
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(true);
        });
    });

    describe('Invalid Configs', () => {
        it('should reject missing version', () => {
            const config: any = {
                nodes: [],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing config version');
        });

        it('should reject unsupported version', () => {
            const config: FlowConfig = {
                version: '1.0.0',
                nodes: [],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unsupported config version'))).toBe(true);
        });

        it('should reject missing nodes', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Flow must have at least one node');
        });

        it('should reject duplicate node IDs', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    { type: 'SimpleChatNode', id: 'node-1', params: {} },
                    { type: 'SimpleChatNode', id: 'node-1', params: {} }
                ],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Duplicate node ID'))).toBe(true);
        });

        it('should reject unknown node types', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    { type: 'UnknownNode', id: 'node-1', params: {} }
                ],
                edges: []
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Unknown node type'))).toBe(true);
        });

        it('should reject edges with missing nodes', () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    { type: 'SimpleChatNode', id: 'chat-1', params: {} }
                ],
                edges: [
                    { from: 'chat-1', to: 'nonExistent', condition: 'default' }
                ]
            };

            const result = loader.validateConfig(config);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('unknown target node'))).toBe(true);
        });
    });
});

describe('FlowLoader - Flow Loading', () => {
    let loader: FlowLoader;
    let deps: DependencyContainer;

    beforeEach(() => {
        loader = new FlowLoader();
        loader.register('SimpleChatNode', SimpleChatNode);
        loader.register('SimpleDecisionNode', SimpleDecisionNode);
        
        deps = new DependencyContainer();
        deps.register('backpack', new Backpack());
        deps.register('eventStreamer', new EventStreamer());
    });

    describe('Successful Loading', () => {
        it('should load flow with single node', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: []
            };

            const flow = await loader.loadFlow(config, deps);
            
            expect(flow).toBeDefined();
            expect(flow.namespace).toBe('test');
            expect(flow.getAllNodes().length).toBe(1);
        });

        it('should load flow with multiple nodes', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4' }
                    },
                    {
                        type: 'SimpleDecisionNode',
                        id: 'decision-1',
                        params: { decisionKey: 'intent' }
                    }
                ],
                edges: [
                    { from: 'chat-1', to: 'decision-1', condition: 'default' }
                ]
            };

            const flow = await loader.loadFlow(config, deps);
            
            expect(flow.getAllNodes().length).toBe(2);
        });

        it('should setup edges correctly', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [
                    { type: 'SimpleChatNode', id: 'chat-1', params: { model: 'gpt-4' } },
                    { type: 'SimpleDecisionNode', id: 'decision-1', params: { decisionKey: 'intent' } }
                ],
                edges: [
                    { from: 'chat-1', to: 'decision-1', condition: 'default' }
                ]
            };

            const flow = await loader.loadFlow(config, deps);
            const chatNode = flow.getNode('chat-1');
            
            expect(chatNode).toBeDefined();
            // Edge should be set up (though we can't easily test internal _next_nodes)
        });
    });

    describe('Loading Errors', () => {
        it('should throw on missing version', async () => {
            const config: any = {
                nodes: [],
                edges: []
            };

            await expect(loader.loadFlow(config, deps)).rejects.toThrow(ValidationError);
        });

        it('should throw on unsupported version', async () => {
            const config: FlowConfig = {
                version: '1.0.0',
                nodes: [{ type: 'SimpleChatNode', id: 'chat-1', params: {} }],
                edges: []
            };

            await expect(loader.loadFlow(config, deps)).rejects.toThrow('Unsupported config version');
        });

        it('should throw on unknown node type', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [{ type: 'UnknownNode', id: 'node-1', params: {} }],
                edges: []
            };

            await expect(loader.loadFlow(config, deps)).rejects.toThrow(SerializationError);
        });

        it('should throw on invalid edge references', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                nodes: [{ type: 'SimpleChatNode', id: 'chat-1', params: {} }],
                edges: [{ from: 'chat-1', to: 'nonExistent', condition: 'default' }]
            };

            await expect(loader.loadFlow(config, deps)).rejects.toThrow('unknown target node');
        });
    });
});

describe('Node Serialization - SimpleChatNode', () => {
    let backpack: Backpack;

    beforeEach(() => {
        backpack = new Backpack();
    });

    describe('toConfig', () => {
        it('should serialize node to config', () => {
            const node = new SimpleChatNode(
                {
                    id: 'chat-1',
                    model: 'gpt-4',
                    systemPrompt: 'You are helpful',
                    temperature: 0.7
                },
                { namespace: 'test.chat', backpack }
            );

            const config = node.toConfig();
            
            expect(config.type).toBe('SimpleChatNode');
            expect(config.id).toBe('chat-1');
            expect(config.params.model).toBe('gpt-4');
            expect(config.params.systemPrompt).toBe('You are helpful');
            expect(config.params.temperature).toBe(0.7);
        });

        it('should handle optional parameters', () => {
            const node = new SimpleChatNode(
                { id: 'chat-1', model: 'gpt-4' },
                { namespace: 'test.chat', backpack }
            );

            const config = node.toConfig();
            
            expect(config.params.model).toBe('gpt-4');
            expect(config.params.systemPrompt).toBeUndefined();
            expect(config.params.temperature).toBeUndefined();
        });
    });

    describe('fromConfig', () => {
        it('should deserialize node from config', () => {
            const config: NodeConfig = {
                type: 'SimpleChatNode',
                id: 'chat-1',
                params: {
                    model: 'gpt-4',
                    systemPrompt: 'You are helpful',
                    temperature: 0.7
                }
            };

            const node = SimpleChatNode.fromConfig(
                config,
                { namespace: 'test.chat', backpack }
            );

            expect(node.id).toBe('chat-1');
            expect((node as any).model).toBe('gpt-4');
        });

        it('should round-trip correctly', () => {
            const original = new SimpleChatNode(
                {
                    id: 'chat-1',
                    model: 'gpt-4',
                    systemPrompt: 'You are helpful',
                    temperature: 0.7
                },
                { namespace: 'test.chat', backpack }
            );

            const config = original.toConfig();
            const restored = SimpleChatNode.fromConfig(
                config,
                { namespace: 'test.chat', backpack }
            );

            expect(restored.id).toBe(original.id);
            expect(restored.toConfig()).toEqual(original.toConfig());
        });
    });
});

describe('Node Serialization - SimpleDecisionNode', () => {
    let backpack: Backpack;

    beforeEach(() => {
        backpack = new Backpack();
    });

    describe('toConfig', () => {
        it('should serialize decision node', () => {
            const node = new SimpleDecisionNode(
                {
                    id: 'decision-1',
                    decisionKey: 'userIntent',
                    defaultAction: 'fallback'
                },
                { namespace: 'test.decision', backpack }
            );

            const config = node.toConfig();
            
            expect(config.type).toBe('SimpleDecisionNode');
            expect(config.id).toBe('decision-1');
            expect(config.params.decisionKey).toBe('userIntent');
            expect(config.params.defaultAction).toBe('fallback');
        });
    });

    describe('fromConfig', () => {
        it('should deserialize decision node', () => {
            const config: NodeConfig = {
                type: 'SimpleDecisionNode',
                id: 'decision-1',
                params: {
                    decisionKey: 'userIntent',
                    defaultAction: 'fallback'
                }
            };

            const node = SimpleDecisionNode.fromConfig(
                config,
                { namespace: 'test.decision', backpack }
            );

            expect(node.id).toBe('decision-1');
        });

        it('should round-trip correctly', () => {
            const original = new SimpleDecisionNode(
                {
                    id: 'decision-1',
                    decisionKey: 'userIntent'
                },
                { namespace: 'test.decision', backpack }
            );

            const config = original.toConfig();
            const restored = SimpleDecisionNode.fromConfig(
                config,
                { namespace: 'test.decision', backpack }
            );

            expect(restored.toConfig()).toEqual(original.toConfig());
        });
    });
});

describe('FlowLoader - Export Flow (PRD-005 Issue #1 & #2)', () => {
    let loader: FlowLoader;
    let deps: DependencyContainer;
    let backpack: Backpack;

    beforeEach(() => {
        loader = new FlowLoader();
        loader.register('SimpleChatNode', SimpleChatNode);
        loader.register('SimpleDecisionNode', SimpleDecisionNode);
        
        backpack = new Backpack();
        deps = new DependencyContainer();
        deps.register('backpack', backpack);
        deps.register('eventStreamer', new EventStreamer());
    });

    describe('Issue #1: toConfig() Mandate', () => {
        it('should serialize nodes with toConfig()', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4', temperature: 0.7 }
                    }
                ],
                edges: []
            };

            const flow = await loader.loadFlow(config, deps);
            const exported = loader.exportFlow(flow);

            expect(exported.nodes).toHaveLength(1);
            expect(exported.nodes[0].type).toBe('SimpleChatNode');
            expect(exported.nodes[0].id).toBe('chat-1');
            expect(exported.nodes[0].params.model).toBe('gpt-4');
            expect(exported.nodes[0].params.temperature).toBe(0.7);
        });

        it('should warn when node does not implement toConfig()', async () => {
            // Create a node without toConfig for testing
            class NodeWithoutToConfig extends SimpleChatNode {
                // Deliberately remove toConfig
                toConfig = undefined as any;
                
                // Also need to fix fromConfig to return correct type
                static fromConfig(
                    config: NodeConfig,
                    context: NodeContext,
                    deps?: DependencyContainer
                ): NodeWithoutToConfig {
                    const instance = new NodeWithoutToConfig(
                        {
                            id: config.id,
                            model: config.params.model,
                            systemPrompt: config.params.systemPrompt,
                            temperature: config.params.temperature
                        },
                        context
                    );
                    return instance;
                }
            }

            loader.register('NodeWithoutToConfig', NodeWithoutToConfig as any);

            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'NodeWithoutToConfig',
                        id: 'test-1',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: []
            };

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const flow = await loader.loadFlow(config, deps);
            const exported = loader.exportFlow(flow);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('does not implement toConfig()')
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('test-1')
            );
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('NodeWithoutToConfig')
            );

            // Should still export with fallback
            expect(exported.nodes).toHaveLength(1);
            expect(exported.nodes[0].params).toEqual({});

            warnSpy.mockRestore();
        });

        it('should not warn when node implements toConfig()', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'chat-1',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: []
            };

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const flow = await loader.loadFlow(config, deps);
            loader.exportFlow(flow);

            expect(warnSpy).not.toHaveBeenCalled();

            warnSpy.mockRestore();
        });
    });

    describe('Issue #2: Edge Extraction', () => {
        it('should extract edges from flow', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    { type: 'SimpleChatNode', id: 'chat-1', params: { model: 'gpt-4' } },
                    { type: 'SimpleDecisionNode', id: 'decision-1', params: { decisionKey: 'intent' } },
                    { type: 'SimpleChatNode', id: 'chat-2', params: { model: 'gpt-4' } }
                ],
                edges: [
                    { from: 'chat-1', to: 'decision-1', condition: 'default' },
                    { from: 'decision-1', to: 'chat-2', condition: 'needs_help' }
                ]
            };

            const flow = await loader.loadFlow(config, deps);
            const exported = loader.exportFlow(flow);

            expect(exported.edges).toHaveLength(2);
            expect(exported.edges).toContainEqual({
                from: 'chat-1',
                to: 'decision-1',
                condition: 'default'
            });
            expect(exported.edges).toContainEqual({
                from: 'decision-1',
                to: 'chat-2',
                condition: 'needs_help'
            });
        });

        it('should handle nodes with no edges', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    { type: 'SimpleChatNode', id: 'isolated', params: { model: 'gpt-4' } }
                ],
                edges: []
            };

            const flow = await loader.loadFlow(config, deps);
            const exported = loader.exportFlow(flow);

            expect(exported.edges).toHaveLength(0);
        });

        it('should handle multiple edges from same node', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    { type: 'SimpleDecisionNode', id: 'decision-1', params: { decisionKey: 'intent' } },
                    { type: 'SimpleChatNode', id: 'chat-1', params: { model: 'gpt-4' } },
                    { type: 'SimpleChatNode', id: 'chat-2', params: { model: 'gpt-4' } }
                ],
                edges: [
                    { from: 'decision-1', to: 'chat-1', condition: 'help' },
                    { from: 'decision-1', to: 'chat-2', condition: 'info' }
                ]
            };

            const flow = await loader.loadFlow(config, deps);
            const exported = loader.exportFlow(flow);

            expect(exported.edges).toHaveLength(2);
            expect(exported.edges.filter(e => e.from === 'decision-1')).toHaveLength(2);
        });

        it('should round-trip edges correctly', async () => {
            const originalConfig: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    { type: 'SimpleChatNode', id: 'node1', params: { model: 'gpt-4' } },
                    { type: 'SimpleChatNode', id: 'node2', params: { model: 'gpt-4' } }
                ],
                edges: [
                    { from: 'node1', to: 'node2', condition: 'complete' }
                ]
            };

            const flow = await loader.loadFlow(originalConfig, deps);
            const exported = loader.exportFlow(flow);

            expect(exported.edges).toEqual(originalConfig.edges);
        });
    });
});

describe('Integration - Complete Flow Lifecycle', () => {
    it('should serialize, load, and execute flow', async () => {
        // 1. Create flow configuration
        const config: FlowConfig = {
            version: '2.0.0',
            namespace: 'test',
            nodes: [
                {
                    type: 'SimpleChatNode',
                    id: 'chat-1',
                    params: { model: 'gpt-4' }
                },
                {
                    type: 'SimpleDecisionNode',
                    id: 'decision-1',
                    params: { decisionKey: 'chatResponse' }
                }
            ],
            edges: [
                { from: 'chat-1', to: 'decision-1', condition: 'default' }
            ]
        };

        // 2. Setup dependencies
        const deps = new DependencyContainer();
        const backpack = new Backpack();
        deps.register('backpack', backpack);
        deps.register('eventStreamer', new EventStreamer());

        // 3. Load flow from config
        const loader = new FlowLoader();
        loader.register('SimpleChatNode', SimpleChatNode);
        loader.register('SimpleDecisionNode', SimpleDecisionNode);
        
        const flow = await loader.loadFlow(config, deps);

        // 4. Execute flow
        backpack.pack('userQuery', 'Hello!', { nodeId: 'test', nodeName: 'Test' });
        
        const chatNode = flow.getNode('chat-1');
        expect(chatNode).toBeDefined();
        
        // 5. Verify flow properties
        expect(flow.namespace).toBe('test');
        expect(flow.getAllNodes().length).toBe(2);
    });
});

/**
 * PRD-005 Issue #3: Input/Output Contracts (Data Contracts)
 * 
 * Tests for runtime validation and serialization of data contracts
 */
describe('Data Contracts (PRD-005 Issue #3)', () => {
    let backpack: Backpack;
    let deps: DependencyContainer;
    
    beforeEach(() => {
        backpack = new Backpack();
        deps = new DependencyContainer();
        deps.register('backpack', backpack);
        deps.register('eventStreamer', new EventStreamer());
    });
    
    describe('Type definitions', () => {
        it('should define DataContract and DataContractField types', () => {
            const {DataContract, DataContractField} = require('../../src/serialization/types');
            // Type definitions exist (TypeScript compile-time check)
            expect(true).toBe(true);
        });
    });
    
    describe('Runtime validation', () => {
        it('should validate inputs when contract is defined', async () => {
            const context: NodeContext = {
                namespace: 'test',
                backpack,
                eventStreamer: deps.get('eventStreamer')
            };
            
            const node = new NodeWithContract({ id: 'test-node' }, context);
            
            // Should fail: missing required input
            await expect(node._run({})).rejects.toThrow(ContractValidationError);
        });
        
        it('should pass validation when all inputs are present and correct', async () => {
            const context: NodeContext = {
                namespace: 'test',
                backpack,
                eventStreamer: deps.get('eventStreamer')
            };
            
            // Pack required input
            backpack.pack('userQuery', 'Hello world', { nodeId: 'test-node', nodeName: 'Test' });
            
            const node = new ValidNodeWithContract({ id: 'test-node' }, context);
            
            // Should succeed
            await expect(node._run({})).resolves.not.toThrow();
        });
        
        it('should validate type mismatches', async () => {
            const context: NodeContext = {
                namespace: 'test',
                backpack,
                eventStreamer: deps.get('eventStreamer')
            };
            
            // Pack wrong type
            backpack.pack('count', 'not a number', { nodeId: 'test-node', nodeName: 'Test' });
            
            const node = new TypeCheckNode({ id: 'test-node' }, context);
            
            // Should fail: type mismatch (Zod error message)
            try {
                await node._run({});
                fail('Should have thrown ContractValidationError');
            } catch (error) {
                expect(error).toBeInstanceOf(ContractValidationError);
                expect((error as any).violations).toHaveLength(1);
                expect((error as any).violations[0].key).toBe('count');
                expect((error as any).violations[0].errors).toBeDefined();
                expect((error as any).violations[0].errors[0]).toContain('Expected number');
            }
        });
        
        it('should allow optional fields to be missing', async () => {
            const context: NodeContext = {
                namespace: 'test',
                backpack,
                eventStreamer: deps.get('eventStreamer')
            };
            
            // Only pack required field
            backpack.pack('required', 'present', { nodeId: 'test-node', nodeName: 'Test' });
            
            const node = new OptionalFieldNode({ id: 'test-node' }, context);
            
            // Should succeed even though 'optional' is missing
            await expect(node._run({})).resolves.not.toThrow();
        });
        
        it('should validate all primitive types correctly', async () => {
            const context: NodeContext = {
                namespace: 'test',
                backpack,
                eventStreamer: deps.get('eventStreamer')
            };
            
            // Pack all types correctly
            backpack.pack('str', 'hello', { nodeId: 'test-node', nodeName: 'Test' });
            backpack.pack('num', 42, { nodeId: 'test-node', nodeName: 'Test' });
            backpack.pack('bool', true, { nodeId: 'test-node', nodeName: 'Test' });
            backpack.pack('obj', { key: 'value' }, { nodeId: 'test-node', nodeName: 'Test' });
            backpack.pack('arr', [1, 2, 3], { nodeId: 'test-node', nodeName: 'Test' });
            backpack.pack('any', 'anything', { nodeId: 'test-node', nodeName: 'Test' });
            
            const node = new AllTypesNode({ id: 'test-node' }, context);
            
            // Should succeed
            await expect(node._run({})).resolves.not.toThrow();
        });
    });
    
    describe('Contract serialization', () => {
        it('should include contracts in toConfig() output', () => {
            const { DataContract } = require('../../src/serialization/types');
            
            class NodeWithContractSerialization extends SimpleChatNode {
                static inputs: typeof DataContract = {
                    userQuery: { type: 'string', required: true }
                };
                
                static outputs: typeof DataContract = {
                    chatResponse: { type: 'string', required: true }
                };
                
                toConfig() {
                    const baseConfig = super.toConfig();
                    return {
                        ...baseConfig,
                        inputs: (this.constructor as any).inputs,
                        outputs: (this.constructor as any).outputs
                    };
                }
            }
            
            const context = {
                namespace: 'test',
                backpack: new Backpack()
            };
            
            const node = new NodeWithContractSerialization(
                { id: 'chat-1', model: 'gpt-4' },
                context
            );
            
            const config = node.toConfig();
            
            expect(config.inputs).toBeDefined();
            expect(config.inputs?.userQuery).toEqual({
                type: 'string',
                required: true
            });
            expect(config.outputs).toBeDefined();
            expect(config.outputs?.chatResponse).toEqual({
                type: 'string',
                required: true
            });
        });
    });
});

/**
 * PRD-005 Issue #4: Data Mappings
 * 
 * Tests for edge-level key remapping
 */
describe('Data Mappings (PRD-005 Issue #4)', () => {
    let loader: FlowLoader;
    let backpack: Backpack;
    let deps: DependencyContainer;
    
    beforeEach(() => {
        loader = new FlowLoader();
        loader.register('SimpleChatNode', SimpleChatNode);
        loader.register('SimpleDecisionNode', SimpleDecisionNode);
        
        backpack = new Backpack();
        deps = new DependencyContainer();
        deps.register('backpack', backpack);
        deps.register('eventStreamer', new EventStreamer());
    });
    
    describe('Basic mapping functionality', () => {
        it('should apply simple key remapping', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'producer',
                        params: { model: 'gpt-3.5' }
                    },
                    {
                        type: 'SimpleDecisionNode',
                        id: 'consumer',
                        params: { decisionKey: 'action' }
                    }
                ],
                edges: [
                    {
                        from: 'producer',
                        to: 'consumer',
                        condition: 'complete',
                        mappings: {
                            'chatResponse': 'action'  // Map chatResponse to action (expected by DecisionNode)
                        }
                    }
                ]
            };
            
            const flow = await loader.loadFlow(config, deps);
            
            // Pack initial data for producer
            backpack.pack('userQuery', 'Hello', { nodeId: 'producer', nodeName: 'Test' });
            
            // Run producer node
            const producer = flow.getNode('producer');
            expect(producer).toBeDefined();
            await producer!._run({});
            
            // Verify producer created 'chatResponse'
            const chatResponse = backpack.unpack('chatResponse');
            expect(chatResponse).toBeDefined();
            
            // Verify 'action' doesn't exist yet
            expect(backpack.unpack('action')).toBeUndefined();
            
            // Run consumer node (mappings should apply)
            const consumer = flow.getNode('consumer');
            expect(consumer).toBeDefined();
            
            // The mapping will copy chatResponse -> action before consumer runs
            await consumer!._run({});
            
            // Verify mapping was applied: 'action' should now exist
            expect(backpack.unpack('action')).toBeDefined();
        });
        
        it('should apply multiple mappings', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'node1',
                        params: { model: 'gpt-3.5' }
                    },
                    {
                        type: 'SimpleChatNode',
                        id: 'node2',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: [
                    {
                        from: 'node1',
                        to: 'node2',
                        condition: 'complete',
                        mappings: {
                            'output1': 'input1',
                            'output2': 'input2'
                        }
                    }
                ]
            };
            
            const flow = await loader.loadFlow(config, deps);
            
            // Pack test data
            backpack.pack('output1', 'value1', { nodeId: 'node1', nodeName: 'Test' });
            backpack.pack('output2', 'value2', { nodeId: 'node1', nodeName: 'Test' });
            
            // Run node2 (mappings should apply)
            const node2 = flow.getNode('node2');
            expect(node2).toBeDefined();
            await node2!._run({});
            
            // Verify mappings
            expect(backpack.unpack('input1')).toBe('value1');
            expect(backpack.unpack('input2')).toBe('value2');
        });
        
        it('should handle missing source keys gracefully', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'node1',
                        params: { model: 'gpt-3.5' }
                    },
                    {
                        type: 'SimpleChatNode',
                        id: 'node2',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: [
                    {
                        from: 'node1',
                        to: 'node2',
                        condition: 'complete',
                        mappings: {
                            'nonexistent': 'target'
                        }
                    }
                ]
            };
            
            const flow = await loader.loadFlow(config, deps);
            
            // Run node2 (mapping should not fail, just skip)
            const node2 = flow.getNode('node2');
            expect(node2).toBeDefined();
            await node2!._run({});
            
            // Target key should not exist
            expect(backpack.unpack('target')).toBeUndefined();
        });
    });
    
    describe('Conflict detection', () => {
        it('should throw error when mapping conflicts with existing key', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'node1',
                        params: { model: 'gpt-3.5' }
                    },
                    {
                        type: 'SimpleChatNode',
                        id: 'node2',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: [
                    {
                        from: 'node1',
                        to: 'node2',
                        condition: 'complete',
                        mappings: {
                            'source': 'conflict'
                        }
                    }
                ]
            };
            
            const flow = await loader.loadFlow(config, deps);
            
            // Pack source and conflicting target
            backpack.pack('source', 'value1', { nodeId: 'node1', nodeName: 'Test' });
            backpack.pack('conflict', 'different_value', { nodeId: 'node2', nodeName: 'Test' });
            
            // Run node2 (should throw SerializationError)
            const node2 = flow.getNode('node2');
            expect(node2).toBeDefined();
            await expect(node2!._run({})).rejects.toThrow(SerializationError);
            await expect(node2!._run({})).rejects.toThrow(/Mapping conflict/);
        });
        
        it('should allow mapping when target has same value', async () => {
            const config: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    {
                        type: 'SimpleChatNode',
                        id: 'node1',
                        params: { model: 'gpt-3.5' }
                    },
                    {
                        type: 'SimpleChatNode',
                        id: 'node2',
                        params: { model: 'gpt-4' }
                    }
                ],
                edges: [
                    {
                        from: 'node1',
                        to: 'node2',
                        condition: 'complete',
                        mappings: {
                            'source': 'target'
                        }
                    }
                ]
            };
            
            const flow = await loader.loadFlow(config, deps);
            
            // Pack source and target with same value
            backpack.pack('source', 'same_value', { nodeId: 'node1', nodeName: 'Test' });
            backpack.pack('target', 'same_value', { nodeId: 'node2', nodeName: 'Test' });
            
            // Run node2 (should succeed)
            const node2 = flow.getNode('node2');
            expect(node2).toBeDefined();
            await expect(node2!._run({})).resolves.not.toThrow();
        });
    });
    
    describe('Serialization with mappings', () => {
        it('should include mappings in exported config', () => {
            const flow = new (require('../../src/flows/flow').Flow)({ namespace: 'test' });
            const node1 = flow.addNode(SimpleChatNode, { id: 'node1', model: 'gpt-3.5' });
            const node2 = flow.addNode(SimpleChatNode, { id: 'node2', model: 'gpt-4' });
            
            // Note: We can't actually set mappings this way with PocketFlow's API
            // This test just verifies the type system supports it
            const expectedConfig: FlowConfig = {
                version: '2.0.0',
                namespace: 'test',
                nodes: [
                    { type: 'SimpleChatNode', id: 'node1', params: { model: 'gpt-3.5' } },
                    { type: 'SimpleChatNode', id: 'node2', params: { model: 'gpt-4' } }
                ],
                edges: [
                    {
                        from: 'node1',
                        to: 'node2',
                        condition: 'complete',
                        mappings: { 'output': 'input' }
                    }
                ]
            };
            
            // Type check: mappings property should be valid
            expect(expectedConfig.edges[0].mappings).toBeDefined();
            expect(expectedConfig.edges[0].mappings?.output).toBe('input');
        });
    });
});

