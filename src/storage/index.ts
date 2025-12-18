/**
 * Backpack Storage Module
 * 
 * Exports the core Backpack storage system for BackpackFlow v2.0
 * 
 * Version: 2.0.0
 */

// Core class
export { Backpack } from './backpack';

// Types
export type {
    BaseStorage,
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
} from './types';

// Errors
export {
    BackpackError,
    AccessDeniedError,
    KeyNotFoundError,
    ValidationError,
    InvalidCommitError
} from './errors';

