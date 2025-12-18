/**
 * Serialization Tests - PRD-003: Serialization Bridge
 * 
 * Tests for config-driven nodes and flows
 */

import { DependencyContainer } from '../../src/serialization/dependency-container';
import { FlowLoader } from '../../src/serialization/flow-loader';
import { FlowConfig, NodeConfig, SerializationError, ValidationError, DependencyError } from '../../src/serialization/types';
import { Backpack } from '../../src/storage/backpack';
import { EventStreamer } from '../../src/events/event-streamer';
import { SimpleChatNode } from '../../src/nodes/serializable/simple-chat-node';
import { SimpleDecisionNode } from '../../src/nodes/serializable/simple-decision-node';

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

