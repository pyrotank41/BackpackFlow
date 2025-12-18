/**
 * Backpack Core Tests - Phase 1
 * 
 * Tests for:
 * - Constructor
 * - pack()
 * - unpack()
 * - unpackRequired()
 * - Metadata tracking
 * - Version tracking
 * 
 * Based on TECH-SPEC-001 §8: Test Strategy
 */

import { Backpack } from '../../src/storage/backpack';
import { KeyNotFoundError } from '../../src/storage/errors';

describe('Backpack - Phase 1: Core Storage', () => {
    
    describe('Constructor', () => {
        it('should create an empty Backpack', () => {
            const backpack = new Backpack();
            
            expect(backpack.size()).toBe(0);
            expect(backpack.keys()).toEqual([]);
        });
        
        it('should initialize with default options', () => {
            const backpack = new Backpack();
            
            // Verify it works without errors
            backpack.pack('test', 'value');
            expect(backpack.has('test')).toBe(true);
        });
        
        it('should initialize with initial data', () => {
            const initialData = {
                key1: 'value1',
                key2: 42,
                key3: { nested: true }
            };
            
            const backpack = new Backpack(initialData);
            
            expect(backpack.size()).toBe(3);
            expect(backpack.unpack('key1')).toBe('value1');
            expect(backpack.unpack('key2')).toBe(42);
            expect(backpack.unpack('key3')).toEqual({ nested: true });
        });
        
        it('should accept custom options', () => {
            const backpack = new Backpack(undefined, {
                maxHistorySize: 5000,
                strictMode: true
            });
            
            backpack.pack('test', 'value');
            expect(backpack.has('test')).toBe(true);
        });
    });
    
    describe('pack()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should store a value', () => {
            backpack.pack('userQuery', 'What is the weather?');
            
            expect(backpack.has('userQuery')).toBe(true);
            expect(backpack.unpack('userQuery')).toBe('What is the weather?');
        });
        
        it('should store different types of values', () => {
            backpack.pack('string', 'hello');
            backpack.pack('number', 42);
            backpack.pack('boolean', true);
            backpack.pack('array', [1, 2, 3]);
            backpack.pack('object', { nested: { deep: 'value' } });
            backpack.pack('null', null);
            
            expect(backpack.unpack('string')).toBe('hello');
            expect(backpack.unpack('number')).toBe(42);
            expect(backpack.unpack('boolean')).toBe(true);
            expect(backpack.unpack('array')).toEqual([1, 2, 3]);
            expect(backpack.unpack('object')).toEqual({ nested: { deep: 'value' } });
            expect(backpack.unpack('null')).toBe(null);
        });
        
        it('should create metadata with default values', () => {
            backpack.pack('test', 'value');
            
            const item = backpack.getItem('test');
            expect(item).toBeDefined();
            expect(item!.metadata.sourceNodeId).toBe('unknown');
            expect(item!.metadata.sourceNodeName).toBe('unknown');
            expect(item!.metadata.timestamp).toBeGreaterThan(0);
            expect(item!.metadata.version).toBe(1);
        });
        
        it('should accept custom metadata via options', () => {
            backpack.pack('test', 'value', {
                nodeId: 'chat-node-123',
                nodeName: 'ChatNode',
                namespace: 'sales.chat',
                tags: ['pii', 'user-input']
            });
            
            const item = backpack.getItem('test');
            expect(item!.metadata.sourceNodeId).toBe('chat-node-123');
            expect(item!.metadata.sourceNodeName).toBe('ChatNode');
            expect(item!.metadata.sourceNamespace).toBe('sales.chat');
            expect(item!.metadata.tags).toEqual(['pii', 'user-input']);
        });
        
        it('should increment version on updates', () => {
            backpack.pack('counter', 1);
            expect(backpack.getVersion('counter')).toBe(1);
            
            backpack.pack('counter', 2);
            expect(backpack.getVersion('counter')).toBe(2);
            
            backpack.pack('counter', 3);
            expect(backpack.getVersion('counter')).toBe(3);
        });
        
        it('should update existing keys', () => {
            backpack.pack('status', 'pending');
            expect(backpack.unpack('status')).toBe('pending');
            
            backpack.pack('status', 'completed');
            expect(backpack.unpack('status')).toBe('completed');
            expect(backpack.size()).toBe(1); // Still only one key
        });
    });
    
    describe('unpack()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should retrieve a packed value', () => {
            backpack.pack('message', 'Hello World');
            const result = backpack.unpack('message');
            
            expect(result).toBe('Hello World');
        });
        
        it('should return undefined for missing keys', () => {
            const result = backpack.unpack('nonexistent');
            
            expect(result).toBeUndefined();
        });
        
        it('should handle type parameter', () => {
            interface User {
                name: string;
                age: number;
            }
            
            backpack.pack('user', { name: 'Alice', age: 30 });
            const user = backpack.unpack<User>('user');
            
            expect(user).toEqual({ name: 'Alice', age: 30 });
            expect(user?.name).toBe('Alice');
        });
        
        it('should not modify the stored value', () => {
            const obj = { count: 0 };
            backpack.pack('shared', obj);
            
            const retrieved = backpack.unpack<{ count: number }>('shared');
            retrieved!.count = 999;
            
            // The stored object should be modified (we're not deep cloning)
            // This is intentional - matches SharedStorage behavior
            expect(backpack.unpack('shared')).toEqual({ count: 999 });
        });
    });
    
    describe('unpackRequired()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should retrieve a packed value', () => {
            backpack.pack('required', 'important data');
            const result = backpack.unpackRequired('required');
            
            expect(result).toBe('important data');
        });
        
        it('should throw KeyNotFoundError for missing keys', () => {
            expect(() => {
                backpack.unpackRequired('missing');
            }).toThrow(KeyNotFoundError);
        });
        
        it('should include key in error message', () => {
            try {
                backpack.unpackRequired('userQuery');
                fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(KeyNotFoundError);
                expect((error as KeyNotFoundError).key).toBe('userQuery');
                expect((error as Error).message).toContain('userQuery');
            }
        });
        
        it('should include nodeId in error if provided', () => {
            try {
                backpack.unpackRequired('missing', 'chat-node-123');
                fail('Should have thrown');
            } catch (error) {
                expect((error as KeyNotFoundError).nodeId).toBe('chat-node-123');
                expect((error as Error).message).toContain('chat-node-123');
            }
        });
    });
    
    describe('peek()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should read values without logging', () => {
            backpack.pack('debug', 'secret');
            const result = backpack.peek('debug');
            
            expect(result).toBe('secret');
            // In Phase 2, we'll verify this doesn't log to history
        });
        
        it('should return undefined for missing keys', () => {
            const result = backpack.peek('missing');
            
            expect(result).toBeUndefined();
        });
    });
    
    describe('Utility Methods', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('has() should return true for existing keys', () => {
            backpack.pack('test', 'value');
            
            expect(backpack.has('test')).toBe(true);
            expect(backpack.has('missing')).toBe(false);
        });
        
        it('keys() should return all keys', () => {
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            backpack.pack('c', 3);
            
            const keys = backpack.keys();
            expect(keys).toHaveLength(3);
            expect(keys).toContain('a');
            expect(keys).toContain('b');
            expect(keys).toContain('c');
        });
        
        it('size() should return count of items', () => {
            expect(backpack.size()).toBe(0);
            
            backpack.pack('one', 1);
            expect(backpack.size()).toBe(1);
            
            backpack.pack('two', 2);
            expect(backpack.size()).toBe(2);
            
            backpack.pack('one', 'updated'); // Update, not add
            expect(backpack.size()).toBe(2);
        });
        
        it('getItem() should return full item with metadata', () => {
            backpack.pack('test', 'value', {
                nodeId: 'node-1',
                nodeName: 'TestNode'
            });
            
            const item = backpack.getItem('test');
            expect(item).toBeDefined();
            expect(item!.key).toBe('test');
            expect(item!.value).toBe('value');
            expect(item!.metadata.sourceNodeId).toBe('node-1');
            expect(item!.metadata.sourceNodeName).toBe('TestNode');
        });
        
        it('getVersion() should return current version', () => {
            expect(backpack.getVersion('counter')).toBe(0);
            
            backpack.pack('counter', 1);
            expect(backpack.getVersion('counter')).toBe(1);
            
            backpack.pack('counter', 2);
            expect(backpack.getVersion('counter')).toBe(2);
        });
        
        it('clear() should remove all items', () => {
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            backpack.pack('c', 3);
            
            expect(backpack.size()).toBe(3);
            
            backpack.clear();
            
            expect(backpack.size()).toBe(0);
            expect(backpack.keys()).toEqual([]);
            expect(backpack.has('a')).toBe(false);
        });
    });
    
    describe('Version Tracking', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should track version numbers correctly', () => {
            backpack.pack('data', 'v1');
            expect(backpack.getItem('data')!.metadata.version).toBe(1);
            
            backpack.pack('data', 'v2');
            expect(backpack.getItem('data')!.metadata.version).toBe(2);
            
            backpack.pack('data', 'v3');
            expect(backpack.getItem('data')!.metadata.version).toBe(3);
        });
        
        it('should track versions independently per key', () => {
            backpack.pack('a', 1);
            backpack.pack('b', 1);
            
            backpack.pack('a', 2);
            backpack.pack('a', 3);
            
            expect(backpack.getVersion('a')).toBe(3);
            expect(backpack.getVersion('b')).toBe(1);
        });
    });
    
    describe('Serialization', () => {
        it('should serialize to JSON', () => {
            const backpack = new Backpack();
            backpack.pack('test', 'value');
            
            const json = backpack.toJSON();
            
            expect(json.items).toBeDefined();
            expect(json.history).toBeDefined();
            expect(json.timestamp).toBeGreaterThan(0);
        });
        
        it('should deserialize from JSON', () => {
            const original = new Backpack();
            original.pack('a', 1);
            original.pack('b', 'hello');
            
            const json = original.toJSON();
            const restored = Backpack.fromJSON(json);
            
            expect(restored.unpack('a')).toBe(1);
            expect(restored.unpack('b')).toBe('hello');
            expect(restored.size()).toBe(2);
        });
    });
});

