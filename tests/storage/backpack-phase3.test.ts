/**
 * Backpack Phase 3 Tests - Access Control
 * 
 * Tests for:
 * - Permission registration
 * - Key-based permissions (read/write/deny)
 * - Namespace-based permissions with wildcards
 * - Access denial (strictMode vs graceful)
 * - Pattern matching algorithm
 * 
 * Based on TECH-SPEC-001 §8: Test Strategy - Phase 3
 */

import { Backpack } from '../../src/storage/backpack';
import { AccessDeniedError } from '../../src/storage/errors';
import { NodePermissions } from '../../src/storage/types';

describe('Backpack - Phase 3: Access Control', () => {
    
    describe('Permission Registration', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should register permissions for a node', () => {
            const permissions: NodePermissions = {
                read: ['key1', 'key2'],
                write: ['output']
            };
            
            backpack.registerPermissions('node-1', permissions);
            
            const registered = backpack.getPermissions();
            expect(registered.get('node-1')).toEqual(permissions);
        });
        
        it('should allow multiple nodes to register permissions', () => {
            backpack.registerPermissions('node-1', { read: ['a'] });
            backpack.registerPermissions('node-2', { read: ['b'] });
            
            const permissions = backpack.getPermissions();
            expect(permissions.size).toBe(2);
        });
        
        it('should allow clearing permissions', () => {
            backpack.registerPermissions('node-1', { read: ['test'] });
            expect(backpack.getPermissions().has('node-1')).toBe(true);
            
            backpack.clearPermissions('node-1');
            expect(backpack.getPermissions().has('node-1')).toBe(false);
        });
    });
    
    describe('Key-Based Read Permissions', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
            backpack.pack('public', 'everyone can read');
            backpack.pack('private', 'restricted', { nodeId: 'owner' });
        });
        
        it('should allow reading keys in read permission list', () => {
            backpack.registerPermissions('node-1', {
                read: ['public']
            });
            
            const value = backpack.unpack('public', 'node-1');
            expect(value).toBe('everyone can read');
        });
        
        it('should deny reading keys not in permission list', () => {
            backpack.registerPermissions('node-1', {
                read: ['public']
            });
            
            // Graceful mode - returns undefined
            const value = backpack.unpack('private', 'node-1');
            expect(value).toBeUndefined();
        });
        
        it('should throw AccessDeniedError in strictMode', () => {
            const strictBackpack = new Backpack(undefined, { 
                enableAccessControl: true,
                strictMode: true 
            });
            
            strictBackpack.pack('data', 'value');
            strictBackpack.registerPermissions('node-1', {
                read: ['other-key']
            });
            
            expect(() => {
                strictBackpack.unpack('data', 'node-1');
            }).toThrow(AccessDeniedError);
        });
        
        it('should allow access when no permissions registered (opt-in)', () => {
            // Node without registered permissions can access everything
            const value = backpack.unpack('public', 'unregistered-node');
            expect(value).toBe('everyone can read');
        });
        
        it('should work with unpackRequired()', () => {
            backpack.registerPermissions('node-1', {
                read: ['public']
            });
            
            // Should work
            expect(backpack.unpackRequired('public', 'node-1')).toBe('everyone can read');
            
            // Should throw (access denied, not key not found)
            expect(() => {
                backpack.unpackRequired('private', 'node-1');
            }).toThrow(AccessDeniedError);
        });
    });
    
    describe('Key-Based Write Permissions', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
        });
        
        it('should allow writing keys in write permission list', () => {
            backpack.registerPermissions('node-1', {
                write: ['output']
            });
            
            backpack.pack('output', 'result', { nodeId: 'node-1' });
            expect(backpack.has('output')).toBe(true);
        });
        
        it('should deny writing keys not in permission list', () => {
            backpack.registerPermissions('node-1', {
                write: ['output']
            });
            
            // Graceful mode - silently fails
            backpack.pack('forbidden', 'nope', { nodeId: 'node-1' });
            expect(backpack.has('forbidden')).toBe(false);
        });
        
        it('should throw AccessDeniedError in strictMode for writes', () => {
            const strictBackpack = new Backpack(undefined, { 
                enableAccessControl: true,
                strictMode: true 
            });
            
            strictBackpack.registerPermissions('node-1', {
                write: ['allowed']
            });
            
            expect(() => {
                strictBackpack.pack('forbidden', 'value', { nodeId: 'node-1' });
            }).toThrow(AccessDeniedError);
        });
    });
    
    describe('Deny List', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
            backpack.pack('public', 'data');
            backpack.pack('sensitive', 'secret');
        });
        
        it('should deny access to keys in deny list', () => {
            backpack.registerPermissions('node-1', {
                read: ['public', 'sensitive'],  // Allowed
                deny: ['sensitive']             // But explicitly denied
            });
            
            // Can read public
            expect(backpack.unpack('public', 'node-1')).toBe('data');
            
            // Cannot read sensitive (denied)
            expect(backpack.unpack('sensitive', 'node-1')).toBeUndefined();
        });
        
        it('should prioritize deny over allow', () => {
            backpack.registerPermissions('node-1', {
                read: ['sensitive'],
                deny: ['sensitive']  // Deny takes precedence
            });
            
            expect(backpack.unpack('sensitive', 'node-1')).toBeUndefined();
        });
    });
    
    describe('Namespace-Based Permissions', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
            
            // Pack items with different namespaces
            backpack.pack('chat', 'msg1', { 
                nodeId: 'chat-1', 
                namespace: 'sales.chat' 
            });
            backpack.pack('search', 'results', { 
                nodeId: 'search-1', 
                namespace: 'sales.search' 
            });
            backpack.pack('report', 'data', { 
                nodeId: 'report-1', 
                namespace: 'reporting.analytics' 
            });
        });
        
        it('should allow reading from namespaces matching pattern', () => {
            backpack.registerPermissions('node-1', {
                namespaceRead: ['sales.*']
            });
            
            // Can read from sales namespace
            expect(backpack.unpack('chat', 'node-1')).toBe('msg1');
            expect(backpack.unpack('search', 'node-1')).toBe('results');
            
            // Cannot read from reporting namespace
            expect(backpack.unpack('report', 'node-1')).toBeUndefined();
        });
        
        it('should support wildcard at beginning', () => {
            backpack.registerPermissions('node-1', {
                namespaceRead: ['*.chat']
            });
            
            expect(backpack.unpack('chat', 'node-1')).toBe('msg1');
            expect(backpack.unpack('search', 'node-1')).toBeUndefined();
        });
        
        it('should support exact namespace match', () => {
            backpack.registerPermissions('node-1', {
                namespaceRead: ['sales.chat']  // Exact match only
            });
            
            expect(backpack.unpack('chat', 'node-1')).toBe('msg1');
            expect(backpack.unpack('search', 'node-1')).toBeUndefined();
        });
        
        it('should support multiple namespace patterns', () => {
            backpack.registerPermissions('node-1', {
                namespaceRead: ['sales.*', 'reporting.*']
            });
            
            // Can read from both namespaces
            expect(backpack.unpack('chat', 'node-1')).toBe('msg1');
            expect(backpack.unpack('report', 'node-1')).toBe('data');
        });
        
        it('should work with write permissions', () => {
            backpack.registerPermissions('node-1', {
                namespaceWrite: ['output.*']
            });
            
            // Can write to output namespace
            backpack.pack('result', 'success', { 
                nodeId: 'node-1', 
                namespace: 'output.final' 
            });
            expect(backpack.has('result')).toBe(true);
        });
    });
    
    describe('Pattern Matching Algorithm', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
        });
        
        it('should match exact patterns', () => {
            backpack.pack('data', 'value', { 
                nodeId: 'node-1', 
                namespace: 'sales.chat' 
            });
            
            backpack.registerPermissions('reader', {
                namespaceRead: ['sales.chat']
            });
            
            expect(backpack.unpack('data', 'reader')).toBe('value');
        });
        
        it('should match single-level wildcards', () => {
            backpack.pack('a', '1', { nodeId: 'x', namespace: 'sales.chat' });
            backpack.pack('b', '2', { nodeId: 'x', namespace: 'sales.search' });
            backpack.pack('c', '3', { nodeId: 'x', namespace: 'sales.api.v1' });
            
            backpack.registerPermissions('reader', {
                namespaceRead: ['sales.*']
            });
            
            // Matches one level deep
            expect(backpack.unpack('a', 'reader')).toBe('1');
            expect(backpack.unpack('b', 'reader')).toBe('2');
            
            // Does NOT match two levels deep (sales.api.v1)
            expect(backpack.unpack('c', 'reader')).toBeUndefined();
        });
        
        it('should match wildcards at any position', () => {
            backpack.pack('test', 'value', { 
                nodeId: 'x', 
                namespace: 'sales.chat.room1' 
            });
            
            backpack.registerPermissions('reader', {
                namespaceRead: ['*.chat.*']
            });
            
            expect(backpack.unpack('test', 'reader')).toBe('value');
        });
        
        it('should not match across dots without wildcard', () => {
            backpack.pack('data', 'value', { 
                nodeId: 'x', 
                namespace: 'sales.chat.web' 
            });
            
            backpack.registerPermissions('reader', {
                namespaceRead: ['sales.chat']  // Exact match only
            });
            
            expect(backpack.unpack('data', 'reader')).toBeUndefined();
        });
    });
    
    describe('Combined Permissions', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack(undefined, { enableAccessControl: true });
            
            backpack.pack('specificKey', 'value1');
            backpack.pack('namespaced', 'value2', { 
                nodeId: 'x', 
                namespace: 'sales.chat' 
            });
        });
        
        it('should allow access via key OR namespace permission', () => {
            backpack.registerPermissions('node-1', {
                read: ['specificKey'],
                namespaceRead: ['sales.*']
            });
            
            // Can read via key permission
            expect(backpack.unpack('specificKey', 'node-1')).toBe('value1');
            
            // Can read via namespace permission
            expect(backpack.unpack('namespaced', 'node-1')).toBe('value2');
        });
        
        it('should respect deny list even with namespace permissions', () => {
            backpack.registerPermissions('node-1', {
                namespaceRead: ['sales.*'],
                deny: ['namespaced']
            });
            
            expect(backpack.unpack('namespaced', 'node-1')).toBeUndefined();
        });
    });
    
    describe('Access Control Integration', () => {
        it('should work with full workflow', () => {
            const backpack = new Backpack(undefined, { enableAccessControl: true });
            
            // Setup permissions for a chat node
            backpack.registerPermissions('chat-node', {
                read: ['userQuery'],
                write: ['chatMessage'],
                namespaceRead: ['context.*']
            });
            
            // Setup permissions for a search node
            backpack.registerPermissions('search-node', {
                read: ['chatMessage'],
                write: ['searchResults']
            });
            
            // Pack initial data
            backpack.pack('userQuery', 'Hello', { nodeId: 'system' });
            backpack.pack('contextData', 'info', { 
                nodeId: 'system', 
                namespace: 'context.user' 
            });
            
            // Chat node can read query and context
            expect(backpack.unpack('userQuery', 'chat-node')).toBe('Hello');
            expect(backpack.unpack('contextData', 'chat-node')).toBe('info');
            
            // Chat node can write message
            backpack.pack('chatMessage', 'Hi there!', { nodeId: 'chat-node' });
            expect(backpack.has('chatMessage')).toBe(true);
            
            // Search node can read chat message
            expect(backpack.unpack('chatMessage', 'search-node')).toBe('Hi there!');
            
            // But search node cannot read user query (not in permissions)
            expect(backpack.unpack('userQuery', 'search-node')).toBeUndefined();
        });
    });
    
    describe('Access Control Disabled', () => {
        it('should allow all access when disabled', () => {
            const backpack = new Backpack(undefined, { enableAccessControl: false });
            
            backpack.registerPermissions('node-1', {
                read: ['specific-key']  // This will be ignored
            });
            
            backpack.pack('any-key', 'value');
            
            // Can access anything even with restrictive permissions
            expect(backpack.unpack('any-key', 'node-1')).toBe('value');
        });
    });
});


