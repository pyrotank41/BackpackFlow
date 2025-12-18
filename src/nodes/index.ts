// BackpackFlow v2.0 - Core Exports

// BackpackNode base class (v2.0)
export { BackpackNode, NodeConfig, NodeContext } from './backpack-node';

// Serializable nodes (v2.0)
export * from './serializable';

// Event streaming (v2.0)
export { EventStreamer } from '../events/event-streamer';
export { StreamEventType } from '../events/types';

// Node types
export * from './types';

// MCP core functionality
export * from './mcp-core';

// Legacy v1.x exports (commented out - not compatible with v2.0)
// export * from './llm';
// export { ChatNode } from './llm/chat-node';
// export { DecisionNode } from './decision-node';
// export { FinalAnswerNode } from './final-answer-node';
// export { ToolParamGenerationNode } from './tool-param-generation-node';
// export { ToolExecutionNode } from './tool-execution-node';
// export { AgentNode } from './agent-node';
// export * from './base-llm-node';
