/**
 * Backpack Phase 2 Tests - History & Time-Travel
 * 
 * Tests for:
 * - History tracking (recordCommit)
 * - getHistory()
 * - getKeyHistory()
 * - getSnapshotAtCommit()
 * - getSnapshotBeforeNode()
 * - diff()
 * - replayFromCommit()
 * - Circular buffer (maxHistorySize)
 * 
 * Based on TECH-SPEC-001 §8: Test Strategy - Phase 2
 */

import { Backpack } from '../../src/storage/backpack';
import { InvalidCommitError } from '../../src/storage/errors';

describe('Backpack - Phase 2: History & Time-Travel', () => {
    
    describe('History Tracking', () => {
        let backpack: Backpack;
        
        beforeEach(() => {
            backpack = new Backpack();
        });
        
        it('should record commits when packing values', () => {
            backpack.pack('key1', 'value1', { nodeId: 'node-1', nodeName: 'TestNode' });
            
            const history = backpack.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].action).toBe('pack');
            expect(history[0].key).toBe('key1');
            expect(history[0].nodeId).toBe('node-1');
            expect(history[0].nodeName).toBe('TestNode');
        });
        
        it('should store full values in commits', () => {
            const value = { nested: { data: 'test' } };
            backpack.pack('complex', value, { nodeId: 'node-1' });
            
            const history = backpack.getHistory();
            expect(history[0].newValue).toEqual(value);
            expect(history[0].previousValue).toBeUndefined(); // First commit
        });
        
        it('should track previousValue on updates', () => {
            backpack.pack('counter', 1);
            backpack.pack('counter', 2);
            backpack.pack('counter', 3);
            
            const history = backpack.getHistory();
            expect(history).toHaveLength(3);
            
            // First commit
            expect(history[2].newValue).toBe(1);
            expect(history[2].previousValue).toBeUndefined();
            
            // Second commit
            expect(history[1].newValue).toBe(2);
            expect(history[1].previousValue).toBe(1);
            
            // Third commit
            expect(history[0].newValue).toBe(3);
            expect(history[0].previousValue).toBe(2);
        });
        
        it('should generate unique commit IDs', () => {
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            backpack.pack('c', 3);
            
            const history = backpack.getHistory();
            const commitIds = history.map(c => c.commitId);
            const uniqueIds = new Set(commitIds);
            
            expect(uniqueIds.size).toBe(3);
        });
        
        it('should include timestamps', () => {
            const before = Date.now();
            backpack.pack('test', 'value');
            const after = Date.now();
            
            const history = backpack.getHistory();
            const timestamp = history[0].timestamp;
            
            expect(timestamp).toBeGreaterThanOrEqual(before);
            expect(timestamp).toBeLessThanOrEqual(after);
        });
        
        it('should create value summaries', () => {
            backpack.pack('string', 'Hello World');
            backpack.pack('number', 42);
            backpack.pack('array', [1, 2, 3]);
            backpack.pack('object', { key: 'value' });
            
            const history = backpack.getHistory();
            
            expect(history[3].valueSummary).toContain('Hello World');
            expect(history[2].valueSummary).toBe('42');
            expect(history[1].valueSummary).toContain('Array(3)');
            expect(history[0].valueSummary).toContain('key');
        });
    });
    
    describe('getHistory()', () => {
        it('should return empty array for new backpack', () => {
            const backpack = new Backpack();
            expect(backpack.getHistory()).toEqual([]);
        });
        
        it('should return commits in reverse chronological order (newest first)', () => {
            const backpack = new Backpack();
            
            backpack.pack('first', 1);
            backpack.pack('second', 2);
            backpack.pack('third', 3);
            
            const history = backpack.getHistory();
            
            expect(history[0].key).toBe('third');  // Newest
            expect(history[1].key).toBe('second');
            expect(history[2].key).toBe('first');  // Oldest
        });
        
        it('should return a copy of history (not mutate internal state)', () => {
            const backpack = new Backpack();
            backpack.pack('test', 'value');
            
            const history1 = backpack.getHistory();
            history1.push({} as any);
            
            const history2 = backpack.getHistory();
            expect(history2.length).toBe(1); // Not affected by mutation
        });
    });
    
    describe('getKeyHistory()', () => {
        it('should return commits for a specific key only', () => {
            const backpack = new Backpack();
            
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            backpack.pack('a', 3);
            backpack.pack('c', 4);
            backpack.pack('a', 5);
            
            const aHistory = backpack.getKeyHistory('a');
            
            expect(aHistory).toHaveLength(3);
            expect(aHistory[0].newValue).toBe(5); // Newest
            expect(aHistory[1].newValue).toBe(3);
            expect(aHistory[2].newValue).toBe(1); // Oldest
        });
        
        it('should return empty array for non-existent key', () => {
            const backpack = new Backpack();
            backpack.pack('exists', 'value');
            
            const history = backpack.getKeyHistory('nonexistent');
            expect(history).toEqual([]);
        });
    });
    
    describe('Circular Buffer (maxHistorySize)', () => {
        it('should limit history to maxHistorySize', () => {
            const backpack = new Backpack(undefined, { maxHistorySize: 3 });
            
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            backpack.pack('c', 3);
            backpack.pack('d', 4); // Should evict 'a'
            backpack.pack('e', 5); // Should evict 'b'
            
            const history = backpack.getHistory();
            
            expect(history).toHaveLength(3);
            expect(history[0].key).toBe('e'); // Newest
            expect(history[1].key).toBe('d');
            expect(history[2].key).toBe('c'); // Oldest retained
        });
        
        it('should use default maxHistorySize of 10000', () => {
            const backpack = new Backpack();
            
            // Add 100 commits
            for (let i = 0; i < 100; i++) {
                backpack.pack('test', i);
            }
            
            const history = backpack.getHistory();
            expect(history).toHaveLength(100); // All retained (< 10000)
        });
    });
    
    describe('getSnapshotAtCommit()', () => {
        it('should reconstruct state at a specific commit', () => {
            const backpack = new Backpack();
            
            backpack.pack('data', 'v1');
            const history1 = backpack.getHistory();
            const commit1 = history1[0].commitId;
            
            backpack.pack('data', 'v2');
            backpack.pack('data', 'v3');
            
            // Get snapshot at first commit
            const snapshot = backpack.getSnapshotAtCommit(commit1);
            
            expect(snapshot.unpack('data')).toBe('v1');
            expect(snapshot.size()).toBe(1);
        });
        
        it('should work with multiple keys', () => {
            const backpack = new Backpack();
            
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            const history = backpack.getHistory();
            const commit = history[0].commitId; // After 'b' was added
            
            backpack.pack('c', 3);
            backpack.pack('d', 4);
            
            const snapshot = backpack.getSnapshotAtCommit(commit);
            
            expect(snapshot.has('a')).toBe(true);
            expect(snapshot.has('b')).toBe(true);
            expect(snapshot.has('c')).toBe(false); // Not yet added
            expect(snapshot.has('d')).toBe(false); // Not yet added
        });
        
        it('should throw InvalidCommitError for non-existent commit', () => {
            const backpack = new Backpack();
            backpack.pack('test', 'value');
            
            expect(() => {
                backpack.getSnapshotAtCommit('invalid-commit-id');
            }).toThrow(InvalidCommitError);
        });
        
        it('should preserve values correctly (not references)', () => {
            const backpack = new Backpack();
            
            const obj = { count: 1 };
            backpack.pack('data', obj);
            const commit = backpack.getHistory()[0].commitId;
            
            // Modify original object
            obj.count = 999;
            backpack.pack('data', obj);
            
            // Snapshot should have the value at that commit
            const snapshot = backpack.getSnapshotAtCommit(commit);
            expect(snapshot.unpack('data')).toEqual({ count: 1 });
        });
    });
    
    describe('getSnapshotBeforeNode()', () => {
        it('should return snapshot before node first ran', () => {
            const backpack = new Backpack();
            
            backpack.pack('setup', 'initial', { nodeId: 'setup-node' });
            backpack.pack('data', 'v1', { nodeId: 'node-1' });
            backpack.pack('data', 'v2', { nodeId: 'node-2' });
            
            const snapshot = backpack.getSnapshotBeforeNode('node-1');
            
            expect(snapshot).toBeDefined();
            expect(snapshot!.has('setup')).toBe(true);
            expect(snapshot!.has('data')).toBe(false); // node-1 hasn't run yet
        });
        
        it('should return empty backpack if node was first', () => {
            const backpack = new Backpack();
            
            backpack.pack('first', 'value', { nodeId: 'first-node' });
            
            const snapshot = backpack.getSnapshotBeforeNode('first-node');
            
            expect(snapshot).toBeDefined();
            expect(snapshot!.size()).toBe(0);
        });
        
        it('should return undefined if node not found', () => {
            const backpack = new Backpack();
            backpack.pack('test', 'value', { nodeId: 'existing-node' });
            
            const snapshot = backpack.getSnapshotBeforeNode('nonexistent-node');
            
            expect(snapshot).toBeUndefined();
        });
    });
    
    describe('diff()', () => {
        it('should detect added keys', () => {
            const before = new Backpack();
            before.pack('a', 1);
            
            const after = new Backpack();
            after.pack('a', 1);
            after.pack('b', 2);
            after.pack('c', 3);
            
            const diff = Backpack.diff(before, after);
            
            expect(diff.added).toEqual(['b', 'c']);
            expect(diff.removed).toEqual([]);
            expect(diff.modified).toEqual([]);
        });
        
        it('should detect removed keys', () => {
            const before = new Backpack();
            before.pack('a', 1);
            before.pack('b', 2);
            before.pack('c', 3);
            
            const after = new Backpack();
            after.pack('a', 1);
            
            const diff = Backpack.diff(before, after);
            
            expect(diff.added).toEqual([]);
            expect(diff.removed).toContain('b');
            expect(diff.removed).toContain('c');
        });
        
        it('should detect modified keys', () => {
            const before = new Backpack();
            before.pack('counter', 1);
            before.pack('status', 'pending');
            
            const after = new Backpack();
            after.pack('counter', 999);
            after.pack('status', 'complete');
            
            const diff = Backpack.diff(before, after);
            
            expect(diff.modified).toHaveLength(2);
            expect(diff.modified[0].key).toBe('counter');
            expect(diff.modified[0].oldValue).toBe(1);
            expect(diff.modified[0].newValue).toBe(999);
        });
        
        it('should handle empty backpacks', () => {
            const empty1 = new Backpack();
            const empty2 = new Backpack();
            
            const diff = Backpack.diff(empty1, empty2);
            
            expect(diff.added).toEqual([]);
            expect(diff.removed).toEqual([]);
            expect(diff.modified).toEqual([]);
        });
        
        it('should detect complex changes', () => {
            const before = new Backpack();
            before.pack('unchanged', 'same');
            before.pack('modified', 'old');
            before.pack('removed', 'gone');
            
            const after = new Backpack();
            after.pack('unchanged', 'same');
            after.pack('modified', 'new');
            after.pack('added', 'here');
            
            const diff = Backpack.diff(before, after);
            
            expect(diff.added).toEqual(['added']);
            expect(diff.removed).toEqual(['removed']);
            expect(diff.modified).toHaveLength(1);
            expect(diff.modified[0].key).toBe('modified');
        });
    });
    
    describe('replayFromCommit()', () => {
        it('should replay commits from a specific point', () => {
            const backpack = new Backpack();
            
            backpack.pack('data', 'v1');
            const commit1 = backpack.getHistory()[0].commitId;
            
            backpack.pack('data', 'v2');
            backpack.pack('data', 'v3');
            backpack.pack('extra', 'added');
            
            // Replay from first commit
            const replayed = backpack.replayFromCommit(commit1);
            
            // Should have replayed all subsequent commits
            expect(replayed.unpack('data')).toBe('v3');
            expect(replayed.unpack('extra')).toBe('added');
        });
        
        it('should start from snapshot at commit', () => {
            const backpack = new Backpack();
            
            backpack.pack('a', 1);
            backpack.pack('b', 2);
            const commit = backpack.getHistory()[0].commitId;
            
            backpack.pack('c', 3);
            
            const replayed = backpack.replayFromCommit(commit);
            
            expect(replayed.has('a')).toBe(true);
            expect(replayed.has('b')).toBe(true);
            expect(replayed.has('c')).toBe(true);
        });
    });
    
    describe('Time-Travel Integration', () => {
        it('should enable full debugging workflow', () => {
            const backpack = new Backpack();
            
            // Simulate agent workflow
            backpack.pack('query', 'What is AI?', { nodeId: 'chat', nodeName: 'ChatNode' });
            backpack.pack('thinking', 'Analyzing...', { nodeId: 'agent', nodeName: 'AgentNode' });
            const beforeSearch = backpack.getHistory()[0].commitId;
            
            backpack.pack('searchResults', ['Result 1', 'Result 2'], { nodeId: 'search', nodeName: 'SearchNode' });
            backpack.pack('answer', 'AI is...', { nodeId: 'final', nodeName: 'FinalNode' });
            
            // Debug: What did the agent know before searching?
            const beforeSearchSnapshot = backpack.getSnapshotAtCommit(beforeSearch);
            expect(beforeSearchSnapshot.has('searchResults')).toBe(false);
            expect(beforeSearchSnapshot.has('thinking')).toBe(true);
            
            // Debug: What changed after search?
            const afterSearch = backpack.getSnapshotAtCommit(backpack.getHistory()[1].commitId);
            const diff = Backpack.diff(beforeSearchSnapshot, afterSearch);
            expect(diff.added).toContain('searchResults');
        });
        
        it('should track version evolution', () => {
            const backpack = new Backpack();
            
            backpack.pack('document', { version: 1, content: 'Draft' });
            const v1Commit = backpack.getHistory()[0].commitId;
            
            backpack.pack('document', { version: 2, content: 'Revised' });
            const v2Commit = backpack.getHistory()[0].commitId;
            
            backpack.pack('document', { version: 3, content: 'Final' });
            
            // Time-travel to each version
            const v1 = backpack.getSnapshotAtCommit(v1Commit);
            const v2 = backpack.getSnapshotAtCommit(v2Commit);
            
            expect(v1.unpack('document')).toEqual({ version: 1, content: 'Draft' });
            expect(v2.unpack('document')).toEqual({ version: 2, content: 'Revised' });
            expect(backpack.unpack('document')).toEqual({ version: 3, content: 'Final' });
        });
    });
});

