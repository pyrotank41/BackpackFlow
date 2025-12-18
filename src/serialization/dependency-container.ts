/**
 * BackpackFlow v2.0 - Dependency Container
 * 
 * PRD-003: Dependency Injection for Serialization
 * 
 * Handles non-serializable objects (LLM clients, databases, etc.)
 * that need to be injected when deserializing nodes from config.
 */

import { DependencyError } from './types';

/**
 * Dependency Container
 * 
 * Manages dependency injection for node deserialization.
 * 
 * Usage:
 * ```typescript
 * const deps = new DependencyContainer();
 * deps.register('llmClient', openaiClient);
 * deps.register('eventStreamer', streamer);
 * 
 * const node = ChatNode.fromConfig(config, deps);
 * ```
 */
export class DependencyContainer {
    private dependencies: Map<string, any> = new Map();
    private factories: Map<string, () => any> = new Map();
    
    /**
     * Register a dependency instance
     * 
     * @param key - Dependency key (e.g., "llmClient")
     * @param instance - Dependency instance
     */
    register(key: string, instance: any): void {
        this.dependencies.set(key, instance);
    }
    
    /**
     * Register a dependency factory
     * 
     * Lazy initialization - factory is called only when dependency is requested
     * 
     * @param key - Dependency key
     * @param factory - Factory function that creates the dependency
     */
    registerFactory(key: string, factory: () => any): void {
        this.factories.set(key, factory);
    }
    
    /**
     * Get a dependency
     * 
     * @param key - Dependency key
     * @returns Dependency instance
     * @throws DependencyError if dependency not found
     */
    get<T = any>(key: string): T {
        // Check if already instantiated
        if (this.dependencies.has(key)) {
            return this.dependencies.get(key) as T;
        }
        
        // Check if factory exists
        if (this.factories.has(key)) {
            const factory = this.factories.get(key)!;
            const instance = factory();
            this.dependencies.set(key, instance); // Cache it
            return instance as T;
        }
        
        throw new DependencyError(
            `Dependency '${key}' not registered`,
            key
        );
    }
    
    /**
     * Check if dependency exists
     * 
     * @param key - Dependency key
     * @returns true if dependency is registered
     */
    has(key: string): boolean {
        return this.dependencies.has(key) || this.factories.has(key);
    }
    
    /**
     * Get all registered dependency keys
     * 
     * @returns Array of dependency keys
     */
    keys(): string[] {
        const allKeys = new Set<string>();
        for (const key of this.dependencies.keys()) {
            allKeys.add(key);
        }
        for (const key of this.factories.keys()) {
            allKeys.add(key);
        }
        return Array.from(allKeys);
    }
    
    /**
     * Clear all dependencies
     */
    clear(): void {
        this.dependencies.clear();
        this.factories.clear();
    }
    
    /**
     * Clone the container (shallow copy)
     * 
     * @returns New DependencyContainer with same dependencies
     */
    clone(): DependencyContainer {
        const newContainer = new DependencyContainer();
        for (const [key, value] of this.dependencies) {
            newContainer.register(key, value);
        }
        for (const [key, factory] of this.factories) {
            newContainer.registerFactory(key, factory);
        }
        return newContainer;
    }
    
    /**
     * Create a container with common default dependencies
     * 
     * @returns DependencyContainer with defaults
     */
    static createDefault(): DependencyContainer {
        const container = new DependencyContainer();
        
        // Register factories for common dependencies
        container.registerFactory('eventStreamer', () => {
            const { EventStreamer } = require('../events/event-streamer');
            return new EventStreamer();
        });
        
        container.registerFactory('backpack', () => {
            const { Backpack } = require('../storage/backpack');
            return new Backpack();
        });
        
        return container;
    }
}

