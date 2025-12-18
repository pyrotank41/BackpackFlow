/**
 * Backpack Custom Errors
 * 
 * Based on TECH-SPEC-001 §7: Error Handling
 * Version: 2.0.0
 */

/**
 * Base error class for all Backpack-related errors
 */
export class BackpackError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BackpackError';
        
        // Maintains proper stack trace for where our error was thrown (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Thrown when a node tries to access a key it doesn't have permission for
 */
export class AccessDeniedError extends BackpackError {
    constructor(
        public nodeId: string,
        public key: string,
        public operation: 'read' | 'write',
        message?: string
    ) {
        super(
            message || 
            `Access denied: Node '${nodeId}' cannot ${operation} key '${key}'`
        );
        this.name = 'AccessDeniedError';
    }
}

/**
 * Thrown when unpackRequired() is called for a missing key
 */
export class KeyNotFoundError extends BackpackError {
    constructor(
        public key: string,
        public nodeId?: string,
        message?: string
    ) {
        super(
            message || 
            `Required key '${key}' not found in Backpack${nodeId ? ` (requested by ${nodeId})` : ''}`
        );
        this.name = 'KeyNotFoundError';
    }
}

/**
 * Thrown when validation fails
 */
export class ValidationError extends BackpackError {
    constructor(
        public errors: Array<{ key: string; message: string }>,
        message?: string
    ) {
        super(
            message || 
            `Validation failed: ${errors.map(e => `${e.key}: ${e.message}`).join(', ')}`
        );
        this.name = 'ValidationError';
    }
}

/**
 * Thrown when trying to reconstruct a snapshot from an invalid commit ID
 */
export class InvalidCommitError extends BackpackError {
    constructor(
        public commitId: string,
        message?: string
    ) {
        super(
            message || 
            `Invalid commit ID: '${commitId}' not found in history`
        );
        this.name = 'InvalidCommitError';
    }
}

