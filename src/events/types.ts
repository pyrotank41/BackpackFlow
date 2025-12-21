/**
 * BackpackFlow v2.0 - Telemetry Event Types
 * 
 * Standardized event schema for observability across all nodes.
 * All events are strongly typed with specific payloads.
 */

/**
 * Event Types Enum
 */
export enum StreamEventType {
    // Lifecycle Events (Automatic from BackpackNode)
    NODE_START = 'node_start',
    PREP_COMPLETE = 'prep_complete',
    EXEC_COMPLETE = 'exec_complete',
    NODE_END = 'node_end',
    ERROR = 'error',
    
    // Backpack Operations (Automatic from Backpack)
    BACKPACK_PACK = 'backpack_pack',
    BACKPACK_UNPACK = 'backpack_unpack',
    
    // Custom Events (Manual from node exec)
    STREAM_CHUNK = 'stream_chunk',    // For token streaming
    TOOL_CALL = 'tool_call',          // When an agent calls a tool
    CUSTOM = 'custom'                 // Generic custom payload
}

/**
 * Base Event Envelope
 * All events follow this structure
 */
export interface BackpackEvent<T = any> {
    id: string;             // UUID for this event
    timestamp: number;      // Unix epoch (ms)
    sourceNode: string;     // Node class name (e.g., "ChatNode")
    nodeId: string;         // Node instance ID
    namespace?: string;     // Semantic path (e.g., "sales.research.chat")
    runId: string;          // Correlation ID for the entire flow execution
    type: StreamEventType;
    payload: T;             // Strongly-typed payload
}

/**
 * Lifecycle Event Payloads
 */

export interface NodeStartPayload {
    nodeName: string;
    nodeId: string;
    namespace?: string;
    params: Record<string, any>;        // Node configuration
    backpackSnapshot: Record<string, any>; // Current Backpack state
}

export interface PrepCompletePayload {
    prepResult: unknown;                // The exact data prepared (usually LLM prompt!)
    backpackReads: string[];            // Keys unpacked during prep
}

export interface ExecCompletePayload {
    execResult: unknown;                // Raw result (e.g., LLM response before parsing)
    attempts: number;                   // Retry count
    durationMs: number;                 // Execution time
}

export interface NodeEndPayload {
    action: string | undefined;         // Action string for routing (e.g., "default", "error")
    backpackWrites: string[];           // Keys packed during this node
    durationMs: number;                 // Total node execution time
}

export interface ErrorPayload {
    phase: 'prep' | 'exec' | 'post';
    error: string;                      // error.message
    stack?: string;                     // Full stack trace
    backpackStateAtError: Record<string, any>; // State when error occurred
}

/**
 * Backpack Operation Payloads
 */

export interface BackpackPackPayload {
    key: string;
    valueSummary: string;               // Truncated for large values
    metadata: {
        sourceNodeId: string;
        sourceNodeName: string;
        sourceNamespace?: string;
        timestamp: number;
        version: number;
        tags?: string[];
    };
}

export interface BackpackUnpackPayload {
    key: string;
    requestingNodeId: string;
    accessGranted: boolean;             // False if access denied
    reason?: string;                    // If denied, why?
}

/**
 * Custom Event Payloads
 */

export interface StreamChunkPayload {
    chunk: string;                      // Token or text chunk
    index: number;                      // Chunk sequence number
    final: boolean;                     // Is this the last chunk?
}

export interface ToolCallPayload {
    toolName: string;
    parameters: Record<string, any>;
    result?: unknown;                   // Tool execution result (if available)
}

export interface CustomPayload {
    type: string;                       // Custom event type identifier
    data: Record<string, any>;          // Arbitrary data
}

/**
 * Event Payload Union Type
 */
export type EventPayload =
    | NodeStartPayload
    | PrepCompletePayload
    | ExecCompletePayload
    | NodeEndPayload
    | ErrorPayload
    | BackpackPackPayload
    | BackpackUnpackPayload
    | StreamChunkPayload
    | ToolCallPayload
    | CustomPayload;

/**
 * Event Handler Type
 */
export type EventHandler<T = any> = (event: BackpackEvent<T>) => void | Promise<void>;

/**
 * Event Filter Options
 */
export interface EventFilterOptions {
    nodeId?: string;                    // Filter by node instance ID
    namespace?: string;                 // Filter by namespace pattern (supports wildcards)
    type?: StreamEventType | StreamEventType[]; // Filter by event type(s)
    runId?: string;                     // Filter by flow run ID
}

/**
 * Event Streamer Options
 */
export interface EventStreamerOptions {
    enableHistory?: boolean;            // Store event history (default: true)
    maxHistorySize?: number;            // Max events to store (default: 1000)
    syncEmission?: boolean;             // Emit events synchronously (default: true)
}



