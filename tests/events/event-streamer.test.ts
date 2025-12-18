/**
 * EventStreamer Tests - PRD-002: Telemetry System
 * 
 * Tests for event streaming, history, wildcard matching, and integration
 */

import { EventStreamer } from '../../src/events/event-streamer';
import { StreamEventType, BackpackEvent, NodeStartPayload } from '../../src/events/types';
import { Backpack } from '../../src/storage/backpack';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';

describe('EventStreamer - Core Functionality', () => {
    let streamer: EventStreamer;

    beforeEach(() => {
        streamer = new EventStreamer();
    });

    describe('Event Emission and Subscription', () => {
        it('should emit and receive events', () => {
            const events: BackpackEvent[] = [];
            
            streamer.on(StreamEventType.NODE_START, (event) => {
                events.push(event);
            });

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'TestNode', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'TestNode', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(StreamEventType.NODE_START);
            expect(events[0].sourceNode).toBe('TestNode');
        });

        it('should support wildcard (*) subscription', () => {
            const events: BackpackEvent[] = [];
            
            streamer.on('*', (event) => {
                events.push(event);
            });

            // Emit different event types
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_END,
                { action: 'default', backpackWrites: [], durationMs: 100 },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(StreamEventType.NODE_START);
            expect(events[1].type).toBe(StreamEventType.NODE_END);
        });

        it('should support once() for one-time subscriptions', () => {
            const events: BackpackEvent[] = [];
            
            streamer.once(StreamEventType.NODE_START, (event) => {
                events.push(event);
            });

            // Emit twice
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(events).toHaveLength(1); // Only received once
        });

        it('should support unsubscribing', () => {
            const events: BackpackEvent[] = [];
            const handler = (event: BackpackEvent) => { events.push(event); };
            
            streamer.on(StreamEventType.NODE_START, handler);

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.off(StreamEventType.NODE_START, handler);

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(events).toHaveLength(1); // Only first emission received
        });
    });

    describe('Event History', () => {
        it('should store events in history when enabled', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_END,
                { action: 'default', backpackWrites: [], durationMs: 100 },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            const history = streamer.getHistory();
            expect(history).toHaveLength(2);
        });

        it('should not store history when disabled', () => {
            const streamer = new EventStreamer({ enableHistory: false });

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(streamer.getHistory()).toHaveLength(0);
        });

        it('should limit history size (circular buffer)', () => {
            const streamer = new EventStreamer({ maxHistorySize: 3 });

            // Emit 5 events
            for (let i = 0; i < 5; i++) {
                streamer.emit(
                    StreamEventType.NODE_START,
                    { nodeName: `Test${i}`, nodeId: `test-${i}`, params: {}, backpackSnapshot: {} },
                    { sourceNode: `Test${i}`, nodeId: `test-${i}`, runId: 'run-1' }
                );
            }

            const history = streamer.getHistory();
            expect(history).toHaveLength(3); // Only last 3
            expect(history[0].sourceNode).toBe('Test2'); // Oldest is Test2
        });

        it('should filter history by nodeId', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test1', nodeId: 'node-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test1', nodeId: 'node-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test2', nodeId: 'node-2', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test2', nodeId: 'node-2', runId: 'run-1' }
            );

            const filtered = streamer.getHistory({ nodeId: 'node-1' });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].nodeId).toBe('node-1');
        });

        it('should filter history by event type', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_END,
                { action: 'default', backpackWrites: [], durationMs: 100 },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            const filtered = streamer.getHistory({ type: StreamEventType.NODE_START });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].type).toBe(StreamEventType.NODE_START);
        });

        it('should filter history by runId', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-2', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-2', runId: 'run-2' }
            );

            const filtered = streamer.getHistory({ runId: 'run-1' });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].runId).toBe('run-1');
        });

        it('should filter history by namespace pattern', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', namespace: 'sales.chat', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-2', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-2', namespace: 'sales.research', runId: 'run-1' }
            );

            const filtered = streamer.getHistory({ namespace: 'sales.*' });
            expect(filtered).toHaveLength(2);

            const chatOnly = streamer.getHistory({ namespace: 'sales.chat' });
            expect(chatOnly).toHaveLength(1);
            expect(chatOnly[0].namespace).toBe('sales.chat');
        });

        it('should clear history', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(streamer.getHistorySize()).toBe(1);
            streamer.clearHistory();
            expect(streamer.getHistorySize()).toBe(0);
        });
    });

    describe('Wildcard Namespace Matching', () => {
        it('should match single-level wildcard', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', namespace: 'sales.chat', runId: 'run-1' }
            );

            const events = streamer.getNamespaceEvents('sales.*');
            expect(events).toHaveLength(1);
        });

        it('should match multi-level wildcards', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', namespace: 'sales.research.chat', runId: 'run-1' }
            );

            const events1 = streamer.getNamespaceEvents('sales.*.*');
            expect(events1).toHaveLength(1);

            const events2 = streamer.getNamespaceEvents('sales.research.*');
            expect(events2).toHaveLength(1);
        });

        it('should support onNamespace() for pattern-based subscription', (done) => {
            streamer.onNamespace('sales.*', (event) => {
                expect(event.namespace).toBe('sales.chat');
                done();
            });

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', namespace: 'sales.chat', runId: 'run-1' }
            );
        });
    });

    describe('Event Statistics', () => {
        it('should provide event statistics', () => {
            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', namespace: 'sales.chat', runId: 'run-1' }
            );

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-2', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-2', namespace: 'sales.research', runId: 'run-2' }
            );

            streamer.emit(
                StreamEventType.NODE_END,
                { action: 'default', backpackWrites: [], durationMs: 100 },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            const stats = streamer.getStats();
            expect(stats.totalEvents).toBe(3);
            expect(stats.uniqueNodes).toBe(2);
            expect(stats.uniqueNamespaces).toBe(2);
            expect(stats.uniqueRuns).toBe(2);
            expect(stats.eventsByType[StreamEventType.NODE_START]).toBe(2);
            expect(stats.eventsByType[StreamEventType.NODE_END]).toBe(1);
        });
    });

    describe('Synchronous vs Asynchronous Emission', () => {
        it('should emit synchronously by default', () => {
            const events: BackpackEvent[] = [];
            
            streamer.on(StreamEventType.NODE_START, (event) => {
                events.push(event);
            });

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            expect(events).toHaveLength(1); // Immediately received
        });

        it('should emit asynchronously when configured', (done) => {
            const streamer = new EventStreamer({ syncEmission: false });
            const events: BackpackEvent[] = [];
            
            streamer.on(StreamEventType.NODE_START, (event) => {
                events.push(event);
                expect(events).toHaveLength(1);
                done();
            });

            streamer.emit(
                StreamEventType.NODE_START,
                { nodeName: 'Test', nodeId: 'test-1', params: {}, backpackSnapshot: {} },
                { sourceNode: 'Test', nodeId: 'test-1', runId: 'run-1' }
            );

            // Should not be received yet (async)
            expect(events).toHaveLength(0);
        });
    });
});

describe('Backpack - Event Emission Integration', () => {
    let streamer: EventStreamer;
    let backpack: Backpack;

    beforeEach(() => {
        streamer = new EventStreamer();
        backpack = new Backpack({}, { eventStreamer: streamer, runId: 'test-run' });
    });

    it('should emit BACKPACK_PACK events', () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.BACKPACK_PACK, (event) => {
            events.push(event);
        });

        backpack.pack('testKey', { data: 'test' }, { nodeId: 'test-node', nodeName: 'TestNode' });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.BACKPACK_PACK);
        expect((events[0].payload as any).key).toBe('testKey');
    });

    it('should emit BACKPACK_UNPACK events on successful unpack', () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.BACKPACK_UNPACK, (event) => {
            events.push(event);
        });

        backpack.pack('testKey', 'value', { nodeId: 'test-node', nodeName: 'TestNode' });
        backpack.unpack('testKey', 'test-node');

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.BACKPACK_UNPACK);
        expect((events[0].payload as any).key).toBe('testKey');
        expect((events[0].payload as any).accessGranted).toBe(true);
    });

    it('should emit BACKPACK_UNPACK events on failed unpack (not found)', () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.BACKPACK_UNPACK, (event) => {
            events.push(event);
        });

        backpack.unpack('nonExistentKey', 'test-node');

        expect(events).toHaveLength(1);
        expect((events[0].payload as any).accessGranted).toBe(false);
        expect((events[0].payload as any).reason).toBe('Key not found');
    });

    it('should emit BACKPACK_UNPACK events on access denied', () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.BACKPACK_UNPACK, (event) => {
            events.push(event);
        });

        backpack.registerPermissions('reader-node', {
            read: ['allowedKey'],
            write: []
        });

        backpack.pack('secretKey', 'secret', { nodeId: 'owner-node', nodeName: 'OwnerNode' });
        backpack.unpack('secretKey', 'reader-node');

        expect(events).toHaveLength(1);
        expect((events[0].payload as any).accessGranted).toBe(false);
        expect((events[0].payload as any).reason).toBe('Access denied');
    });
});

describe('BackpackNode - Lifecycle Event Emission', () => {
    let streamer: EventStreamer;
    let backpack: Backpack;
    let flow: any;

    beforeEach(() => {
        streamer = new EventStreamer();
        backpack = new Backpack({}, { eventStreamer: streamer, runId: 'test-run' });
    });

    class TestNode extends BackpackNode {
        static namespaceSegment = 'test';

        async prep(shared: any) {
            this.backpack.unpack('inputKey');
            return { input: 'prepared' };
        }

        async _exec(prepRes: any) {
            return { result: 'executed' };
        }

        async post(shared: any, prepRes: any, execRes: any) {
            this.backpack.pack('outputKey', execRes);
            return 'default';
        }
    }

    it('should emit NODE_START event', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.NODE_START, (event) => {
            events.push(event);
        });

        const node = new TestNode(
            { id: 'test-node' },
            { namespace: 'main.test', backpack, eventStreamer: streamer }
        );

        await node._run({});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.NODE_START);
        expect((events[0].payload as NodeStartPayload).nodeName).toBe('TestNode');
    });

    it('should emit PREP_COMPLETE event', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.PREP_COMPLETE, (event) => {
            events.push(event);
        });

        backpack.pack('inputKey', 'value', { nodeId: 'setup', nodeName: 'Setup' });

        const node = new TestNode(
            { id: 'test-node' },
            { namespace: 'main.test', backpack, eventStreamer: streamer }
        );

        await node._run({});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.PREP_COMPLETE);
        expect((events[0].payload as any).prepResult).toEqual({ input: 'prepared' });
        expect((events[0].payload as any).backpackReads).toContain('inputKey');
    });

    it('should emit EXEC_COMPLETE event', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.EXEC_COMPLETE, (event) => {
            events.push(event);
        });

        const node = new TestNode(
            { id: 'test-node' },
            { namespace: 'main.test', backpack, eventStreamer: streamer }
        );

        await node._run({});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.EXEC_COMPLETE);
        expect((events[0].payload as any).execResult).toEqual({ result: 'executed' });
        expect((events[0].payload as any).durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should emit NODE_END event', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.NODE_END, (event) => {
            events.push(event);
        });

        const node = new TestNode(
            { id: 'test-node' },
            { namespace: 'main.test', backpack, eventStreamer: streamer }
        );

        await node._run({});

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.NODE_END);
        expect((events[0].payload as any).action).toBe('default');
        expect((events[0].payload as any).backpackWrites).toContain('outputKey');
    });

    it('should emit ERROR event on node failure', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on(StreamEventType.ERROR, (event) => {
            events.push(event);
        });

        class FailingNode extends BackpackNode {
            async prep(shared: any) {
                throw new Error('Prep failed!');
            }

            async _exec(prepRes: any) {
                return {};
            }
        }

        const node = new FailingNode(
            { id: 'failing-node' },
            { namespace: 'main.failing', backpack, eventStreamer: streamer }
        );

        await expect(node._run({})).rejects.toThrow('Prep failed!');

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(StreamEventType.ERROR);
        expect((events[0].payload as any).error).toBe('Prep failed!');
        expect((events[0].payload as any).phase).toBe('prep');
    });

    it('should emit complete lifecycle for successful execution', async () => {
        const events: BackpackEvent[] = [];
        
        streamer.on('*', (event) => {
            events.push(event);
        });

        const node = new TestNode(
            { id: 'test-node' },
            { namespace: 'main.test', backpack, eventStreamer: streamer }
        );

        await node._run({});

        // Should have: NODE_START, PREP_COMPLETE, EXEC_COMPLETE, NODE_END, plus pack/unpack events
        const lifecycleEvents = events.filter(e => 
            [StreamEventType.NODE_START, StreamEventType.PREP_COMPLETE, 
             StreamEventType.EXEC_COMPLETE, StreamEventType.NODE_END].includes(e.type)
        );

        expect(lifecycleEvents).toHaveLength(4);
        expect(lifecycleEvents[0].type).toBe(StreamEventType.NODE_START);
        expect(lifecycleEvents[1].type).toBe(StreamEventType.PREP_COMPLETE);
        expect(lifecycleEvents[2].type).toBe(StreamEventType.EXEC_COMPLETE);
        expect(lifecycleEvents[3].type).toBe(StreamEventType.NODE_END);
    });
});

