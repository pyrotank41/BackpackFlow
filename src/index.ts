// BackpackFlow - A config-driven LLM framework built on top of PocketFlow

// Core PocketFlow framework
export * from './pocketflow';

// Production-ready nodes for building AI applications
export * from './nodes';

// LLM providers and abstractions
export * from './providers';

// Event streaming system
export * from './events';

// Types
export * from './types/llm';
export * from './types/events';

// Storage capabilities (explicit exports to avoid conflicts)
export { 
    BaseStorage, 
    SearchCapable, 
    ChatCapable, 
    DocumentCapable, 
    TaskCapable, 
    MemoryCapable,
    ResearchStorage,
    DocumentProcessingStorage,
    SimpleChatStorage,
    AgentStorage,
    createStorage,
    updateStorage,
    hasCapability
} from './storage/capabilities';

// v2.0: Backpack storage system (Git-like state management)
export {
    Backpack,
    BackpackError,
    AccessDeniedError,
    KeyNotFoundError,
    ValidationError,
    InvalidCommitError
} from './storage';

// v2.0: Backpack types
export type {
    BackpackItem,
    BackpackItemMetadata,
    BackpackCommit,
    BackpackOptions,
    PackOptions,
    NodePermissions,
    BackpackSnapshot,
    BackpackDiff,
    ValidationResult,
    NodeContext,
    NodeConfig,
    FlowConfig,
    FlowEdge
} from './storage';

// Utilities (terminal interface, streaming chatbot, etc.)
export * from './utils';

// Examples
export * from './examples';

// Simple API for tutorials and quick prototyping
// export * from './simple'; // TODO: Implement simple API

// Re-export core PocketFlow classes for convenience
export { Node, Flow, BatchNode, ParallelBatchNode, BaseNode } from './pocketflow'; 