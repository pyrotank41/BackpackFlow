/**
 * Backpack Phase 4 Tests - Namespace Query API
 * 
 * Tests for:
 * - unpackByNamespace() - Get values matching namespace pattern
 * - getItemsByNamespace() - Get full items with metadata
 * - getNamespaces() - Get all unique namespaces
 * - Pattern matching across namespaces
 * - Access control integration with namespace queries
 * 
 * Based on TECH-SPEC-001 §5.2: Namespace-Aware API
 */

import { Backpack } from '../../src/storage/backpack';
import { BackpackItem } from '../../src/storage/types';

describe('Backpack - Phase 4: Namespace Query API', () => {
    
    describe('unpackByNamespace()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
            
            // Pack data with different namespaces
            backpack.pack('chat1', 'Hello', { 
                nodeId: 'chat-1', 
                namespace: 'sales.chat' 
            });
            backpack.pack('chat2', 'World', { 
                nodeId: 'chat-2', 
                namespace: 'sales.chat' 
            });
            backpack.pack('search1', 'result-A', { 
                nodeId: 'search-1', 
                namespace: 'sales.search' 
            });
            backpack.pack('report1', 'quarterly', { 
                nodeId: 'report-1', 
                namespace: 'reporting.analytics' 
            });
            backpack.pack('noNamespace', 'orphan');
        });
        
        it('should return all values matching exact namespace', () => {
            const result = backpack.unpackByNamespace('sales.chat');
            
            expect(result).toEqual({
                chat1: 'Hello',
                chat2: 'World'
            });
        });
        
        it('should return all values matching wildcard pattern', () => {
            const result = backpack.unpackByNamespace('sales.*');
            
            expect(result).toEqual({
                chat1: 'Hello',
                chat2: 'World',
                search1: 'result-A'
            });
        });
        
        it('should return empty object when no matches found', () => {
            const result = backpack.unpackByNamespace('nonexistent.*');
            
            expect(result).toEqual({});
        });
        
        it('should exclude items without namespaces', () => {
            const result = backpack.unpackByNamespace('*');
            
            // Should not include 'noNamespace' item
            expect(result).not.toHaveProperty('noNamespace');
        });
        
        it('should support wildcard at beginning', () => {
            const result = backpack.unpackByNamespace('*.chat');
            
            expect(result).toEqual({
                chat1: 'Hello',
                chat2: 'World'
            });
        });
        
        it('should support wildcard at end', () => {
            const result = backpack.unpackByNamespace('sales.*');
            
            expect(Object.keys(result)).toHaveLength(3);
            expect(result).toHaveProperty('chat1');
            expect(result).toHaveProperty('chat2');
            expect(result).toHaveProperty('search1');
        });
        
        it('should match only one level with single wildcard', () => {
            backpack.pack('nested', 'deep', { 
                nodeId: 'x', 
                namespace: 'sales.chat.room1' 
            });
            
            const result = backpack.unpackByNamespace('sales.*');
            
            // Should not include 'nested' (two levels deep)
            expect(result).not.toHaveProperty('nested');
        });
        
        it('should deep clone values to prevent mutation', () => {
            backpack.pack('obj', { foo: 'bar' }, { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            
            const result = backpack.unpackByNamespace('test.*');
            result.obj.foo = 'modified';
            
            // Original should be unchanged
            const original = backpack.unpack('obj');
            expect(original).toEqual({ foo: 'bar' });
        });
    });
    
    describe('getItemsByNamespace()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
            
            backpack.pack('chat1', 'Hello', { 
                nodeId: 'chat-1', 
                nodeName: 'ChatNode',
                namespace: 'sales.chat',
                tags: ['message']
            });
            backpack.pack('chat2', 'World', { 
                nodeId: 'chat-2', 
                nodeName: 'ChatNode',
                namespace: 'sales.chat',
                tags: ['message']
            });
            backpack.pack('search1', 'result-A', { 
                nodeId: 'search-1', 
                nodeName: 'SearchNode',
                namespace: 'sales.search'
            });
        });
        
        it('should return items with full metadata', () => {
            const items = backpack.getItemsByNamespace('sales.chat');
            
            expect(items).toHaveLength(2);
            expect(items[0]).toHaveProperty('key');
            expect(items[0]).toHaveProperty('value');
            expect(items[0]).toHaveProperty('metadata');
            expect(items[0].metadata).toHaveProperty('sourceNodeId');
            expect(items[0].metadata).toHaveProperty('sourceNodeName');
            expect(items[0].metadata).toHaveProperty('sourceNamespace');
            expect(items[0].metadata).toHaveProperty('timestamp');
            expect(items[0].metadata).toHaveProperty('version');
        });
        
        it('should match wildcard patterns', () => {
            const items = backpack.getItemsByNamespace('sales.*');
            
            expect(items).toHaveLength(3);
        });
        
        it('should include tags in metadata', () => {
            const items = backpack.getItemsByNamespace('sales.chat');
            
            expect(items[0].metadata.tags).toContain('message');
            expect(items[1].metadata.tags).toContain('message');
        });
        
        it('should return empty array when no matches', () => {
            const items = backpack.getItemsByNamespace('nonexistent.*');
            
            expect(items).toEqual([]);
        });
        
        it('should deep clone values in returned items', () => {
            backpack.pack('obj', { foo: 'bar' }, { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            
            const items = backpack.getItemsByNamespace('test.*');
            items[0].value.foo = 'modified';
            
            // Original should be unchanged
            const original = backpack.unpack('obj');
            expect(original).toEqual({ foo: 'bar' });
        });
        
        it('should allow filtering by namespace and then by other criteria', () => {
            const items = backpack.getItemsByNamespace('sales.*');
            
            // Filter by nodeName
            const chatItems = items.filter(item => 
                item.metadata.sourceNodeName === 'ChatNode'
            );
            
            expect(chatItems).toHaveLength(2);
        });
    });
    
    describe('getNamespaces()', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should return empty array when no items', () => {
            const namespaces = backpack.getNamespaces();
            
            expect(namespaces).toEqual([]);
        });
        
        it('should return all unique namespaces', () => {
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'sales.chat' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'sales.search' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'reporting.analytics' });
            
            const namespaces = backpack.getNamespaces();
            
            expect(namespaces).toHaveLength(3);
            expect(namespaces).toContain('sales.chat');
            expect(namespaces).toContain('sales.search');
            expect(namespaces).toContain('reporting.analytics');
        });
        
        it('should deduplicate namespaces', () => {
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'sales.chat' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'sales.chat' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'sales.chat' });
            
            const namespaces = backpack.getNamespaces();
            
            expect(namespaces).toEqual(['sales.chat']);
        });
        
        it('should exclude items without namespaces', () => {
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'sales.chat' });
            backpack.pack('b', '2'); // No namespace
            
            const namespaces = backpack.getNamespaces();
            
            expect(namespaces).toEqual(['sales.chat']);
        });
        
        it('should return sorted namespaces', () => {
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'zebra' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'alpha' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'beta' });
            
            const namespaces = backpack.getNamespaces();
            
            expect(namespaces).toEqual(['alpha', 'beta', 'zebra']);
        });
    });
    
    describe('Namespace Queries with Access Control', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
            
            backpack.pack('public1', 'data1', { 
                nodeId: 'owner', 
                namespace: 'public.info' 
            });
            backpack.pack('public2', 'data2', { 
                nodeId: 'owner', 
                namespace: 'public.info' 
            });
            backpack.pack('private1', 'secret1', { 
                nodeId: 'owner', 
                namespace: 'private.secrets' 
            });
            backpack.pack('private2', 'secret2', { 
                nodeId: 'owner', 
                namespace: 'private.secrets' 
            });
        });
        
        it('should respect access control in unpackByNamespace()', () => {
            backpack.registerPermissions('reader', {
                namespaceRead: ['public.*']
            });
            
            const result = backpack.unpackByNamespace('public.*', 'reader');
            
            expect(Object.keys(result)).toHaveLength(2);
            expect(result).toHaveProperty('public1');
            expect(result).toHaveProperty('public2');
        });
        
        it('should filter denied items in unpackByNamespace()', () => {
            backpack.registerPermissions('reader', {
                namespaceRead: ['public.*']
            });
            
            // Try to read all namespaces
            const publicResult = backpack.unpackByNamespace('public.*', 'reader');
            const privateResult = backpack.unpackByNamespace('private.*', 'reader');
            
            expect(Object.keys(publicResult)).toHaveLength(2);
            expect(Object.keys(privateResult)).toHaveLength(0); // Denied
        });
        
        it('should respect access control in getItemsByNamespace()', () => {
            backpack.registerPermissions('reader', {
                namespaceRead: ['public.*']
            });
            
            const items = backpack.getItemsByNamespace('public.*', 'reader');
            
            expect(items).toHaveLength(2);
        });
        
        it('should allow queries without nodeId (bypass access control)', () => {
            backpack.registerPermissions('reader', {
                namespaceRead: ['public.*']
            });
            
            // Without nodeId, access control is bypassed
            const result = backpack.unpackByNamespace('private.*');
            
            expect(Object.keys(result)).toHaveLength(2);
        });
    });
    
    describe('Complex Namespace Patterns', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
            
            // Multi-level namespaces
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'app.v1.chat' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'app.v1.search' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'app.v2.chat' });
            backpack.pack('d', '4', { nodeId: 'x', namespace: 'app.v2.search' });
            backpack.pack('e', '5', { nodeId: 'x', namespace: 'legacy.chat' });
        });
        
        it('should match first level wildcard', () => {
            const result = backpack.unpackByNamespace('app.*');
            
            // Should not match 'app.v1.chat' (two levels deep)
            expect(Object.keys(result)).toHaveLength(0);
        });
        
        it('should match specific pattern', () => {
            const result = backpack.unpackByNamespace('*.chat');
            
            expect(result).toHaveProperty('e'); // legacy.chat
            expect(Object.keys(result)).toHaveLength(1);
        });
        
        it('should handle multiple queries efficiently', () => {
            const v1 = backpack.unpackByNamespace('*.v1.*');
            const v2 = backpack.unpackByNamespace('*.v2.*');
            const chat = backpack.unpackByNamespace('*.chat');
            
            // Pattern *.v1.* matches app.v1.chat and app.v1.search (3 segments)
            expect(Object.keys(v1)).toHaveLength(2);
            expect(v1).toHaveProperty('a'); // app.v1.chat
            expect(v1).toHaveProperty('b'); // app.v1.search
            
            expect(Object.keys(v2)).toHaveLength(2);
            expect(v2).toHaveProperty('c'); // app.v2.chat
            expect(v2).toHaveProperty('d'); // app.v2.search
            
            // Pattern *.chat matches legacy.chat (2 segments)
            expect(Object.keys(chat)).toHaveLength(1);
            expect(chat).toHaveProperty('e'); // legacy.chat
        });
    });
    
    describe('Performance and Edge Cases', () => {
        it('should handle large number of items efficiently', () => {
            const backpack = new Backpack();
            
            // Pack 1000 items
            for (let i = 0; i < 1000; i++) {
                backpack.pack(`item-${i}`, `value-${i}`, {
                    nodeId: 'bulk',
                    namespace: `category-${i % 10}.subcategory`
                });
            }
            
            const start = Date.now();
            const result = backpack.unpackByNamespace('category-5.*');
            const elapsed = Date.now() - start;
            
            expect(Object.keys(result)).toHaveLength(100);
            // CI runners are slower - adjust threshold accordingly
            const threshold = process.env.CI ? 50 : 10;
            expect(elapsed).toBeLessThan(threshold);
        });
        
        it('should handle special characters in namespace', () => {
            const backpack = new Backpack();
            
            backpack.pack('test', 'value', { 
                nodeId: 'x', 
                namespace: 'sales-2024.chat' 
            });
            
            const result = backpack.unpackByNamespace('sales-2024.*');
            
            expect(result).toHaveProperty('test');
        });
        
        it('should return consistent results across multiple calls', () => {
            const backpack = new Backpack();
            
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'test.data' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'test.data' });
            
            const result1 = backpack.unpackByNamespace('test.*');
            const result2 = backpack.unpackByNamespace('test.*');
            
            expect(result1).toEqual(result2);
        });
        
        it('should handle empty pattern gracefully', () => {
            const backpack = new Backpack();
            
            backpack.pack('test', 'value', { 
                nodeId: 'x', 
                namespace: 'sales.chat' 
            });
            
            const result = backpack.unpackByNamespace('');
            
            expect(result).toEqual({});
        });
    });
    
    describe('Integration with Other Features', () => {
        it('should work with versioning', () => {
            const backpack = new Backpack();
            
            backpack.pack('data', 'v1', { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            backpack.pack('data', 'v2', { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            
            const result = backpack.unpackByNamespace('test.*');
            
            // Should get latest version
            expect(result.data).toBe('v2');
        });
        
        it('should work with history tracking', () => {
            const backpack = new Backpack();
            
            backpack.pack('data', 'value', { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            
            backpack.unpackByNamespace('test.*');
            
            const history = backpack.getHistory();
            
            // Should have pack commit
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].action).toBe('pack');
        });
        
        it('should work with serialization', () => {
            const backpack = new Backpack();
            
            backpack.pack('data1', 'value1', { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            backpack.pack('data2', 'value2', { 
                nodeId: 'x', 
                namespace: 'test.data' 
            });
            
            const json = backpack.toJSON();
            const restored = Backpack.fromJSON(json);
            
            const result = restored.unpackByNamespace('test.*');
            
            expect(result).toEqual({
                data1: 'value1',
                data2: 'value2'
            });
        });
    });
});

