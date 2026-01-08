/**
 * BackpackFlow v2.0 - Event Streamer
 * 
 * Type-safe wrapper around Node.js EventEmitter with:
 * - Strongly-typed event payloads
 * - Wildcard pattern matching
 * - Event history for debugging
 * - Integration with Backpack
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    BackpackEvent,
    StreamEventType,
    EventHandler,
    EventFilterOptions,
    EventStreamerOptions,
    EventPayload
} from './types';

export class EventStreamer {
    private emitter: EventEmitter;
    private history: BackpackEvent[];
    private maxHistorySize: number;
    private enableHistory: boolean;
    private syncEmission: boolean;

    constructor(options?: EventStreamerOptions) {
        this.emitter = new EventEmitter();
        this.emitter.setMaxListeners(100); // Increase for complex flows
        
        this.enableHistory = options?.enableHistory ?? true;
        this.maxHistorySize = options?.maxHistorySize ?? 1000;
        this.syncEmission = options?.syncEmission ?? true;
        this.history = [];
    }

    /**
     * Emit an event
     */
    emit<T extends EventPayload>(
        type: StreamEventType,
        payload: T,
        metadata: {
            sourceNode: string;
            nodeId: string;
            namespace?: string;
            runId: string;
        }
    ): void {
        const event: BackpackEvent<T> = {
            id: uuidv4(),
            timestamp: Date.now(),
            type,
            ...metadata,
            payload
        };

        // Store in history
        if (this.enableHistory) {
            this.addToHistory(event);
        }

        const listenerCount = this.emitter.listenerCount(type) + this.emitter.listenerCount('*');
        console.log(`[EventStreamer] Emitting ${type} from ${metadata.sourceNode} (${metadata.nodeId}). Listeners: ${listenerCount}`);

        // Emit to listeners
        if (this.syncEmission) {
            // Synchronous emission
            try {
                this.emitter.emit(type, event);
                this.emitter.emit('*', event); // Wildcard
            } catch (err) {
                console.error(`[EventStreamer] Error emitting event ${type}:`, err);
            }
        } else {
            // Asynchronous (fire-and-forget)
            setImmediate(() => {
                try {
                    this.emitter.emit(type, event);
                    this.emitter.emit('*', event);
                } catch (err) {
                    console.error(`[EventStreamer] Error emitting event ${type} (async):`, err);
                }
            });
        }
    }

    /**
     * Subscribe to events
     */
    on<T extends EventPayload = any>(
        type: StreamEventType | '*',
        handler: EventHandler<T>
    ): void {
        this.emitter.on(type, handler);
    }

    /**
     * Subscribe to events (one-time)
     */
    once<T extends EventPayload = any>(
        type: StreamEventType | '*',
        handler: EventHandler<T>
    ): void {
        this.emitter.once(type, handler);
    }

    /**
     * Unsubscribe from events
     */
    off<T extends EventPayload = any>(
        type: StreamEventType | '*',
        handler: EventHandler<T>
    ): void {
        this.emitter.off(type, handler);
    }

    /**
     * Remove all listeners for an event type
     */
    removeAllListeners(type?: StreamEventType | '*'): void {
        this.emitter.removeAllListeners(type);
    }

    /**
     * Get event history
     */
    getHistory(options?: EventFilterOptions): BackpackEvent[] {
        if (!this.enableHistory) {
            return [];
        }

        let filtered = this.history;

        if (options) {
            if (options.nodeId) {
                filtered = filtered.filter(e => e.nodeId === options.nodeId);
            }

            if (options.type) {
                const types = Array.isArray(options.type) ? options.type : [options.type];
                filtered = filtered.filter(e => types.includes(e.type));
            }

            if (options.runId) {
                filtered = filtered.filter(e => e.runId === options.runId);
            }

            if (options.namespace) {
                const pattern = options.namespace;
                filtered = filtered.filter(e => 
                    e.namespace && this.matchesPattern(pattern, e.namespace)
                );
            }
        }

        return filtered;
    }

    /**
     * Clear event history
     */
    clearHistory(): void {
        this.history = [];
    }

    /**
     * Get history size
     */
    getHistorySize(): number {
        return this.history.length;
    }

    /**
     * Get listener count for an event type
     */
    listenerCount(type: StreamEventType | '*'): number {
        return this.emitter.listenerCount(type);
    }

    /**
     * Add event to history (circular buffer)
     */
    private addToHistory(event: BackpackEvent): void {
        this.history.push(event);

        // Circular buffer: remove oldest if over limit
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Pattern matching for namespace wildcards
     * Supports: "sales.*", "*.research.*", "sales.research.chat"
     */
    private matchesPattern(pattern: string, target: string): boolean {
        // Convert glob-style pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')  // Escape dots
            .replace(/\*/g, '[^\\.]*'); // * matches any segment

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(target);
    }

    /**
     * Get all events for a specific node
     */
    getNodeEvents(nodeId: string): BackpackEvent[] {
        return this.getHistory({ nodeId });
    }

    /**
     * Get all events for a specific namespace
     */
    getNamespaceEvents(namespace: string): BackpackEvent[] {
        return this.getHistory({ namespace });
    }

    /**
     * Get all events for a specific run
     */
    getRunEvents(runId: string): BackpackEvent[] {
        return this.getHistory({ runId });
    }

    /**
     * Get events by type
     */
    getEventsByType(type: StreamEventType | StreamEventType[]): BackpackEvent[] {
        return this.getHistory({ type });
    }

    /**
     * Subscribe to namespace pattern (convenience method)
     */
    onNamespace<T extends EventPayload = any>(
        namespacePattern: string,
        handler: EventHandler<T>
    ): void {
        this.on('*', (event) => {
            if (event.namespace && this.matchesPattern(namespacePattern, event.namespace)) {
                handler(event);
            }
        });
    }

    /**
     * Get event statistics
     */
    getStats(): {
        totalEvents: number;
        eventsByType: Record<string, number>;
        uniqueNodes: number;
        uniqueNamespaces: number;
        uniqueRuns: number;
    } {
        const eventsByType: Record<string, number> = {};
        const uniqueNodes = new Set<string>();
        const uniqueNamespaces = new Set<string>();
        const uniqueRuns = new Set<string>();

        for (const event of this.history) {
            // Count by type
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

            // Track unique values
            uniqueNodes.add(event.nodeId);
            if (event.namespace) uniqueNamespaces.add(event.namespace);
            uniqueRuns.add(event.runId);
        }

        return {
            totalEvents: this.history.length,
            eventsByType,
            uniqueNodes: uniqueNodes.size,
            uniqueNamespaces: uniqueNamespaces.size,
            uniqueRuns: uniqueRuns.size
        };
    }
}
