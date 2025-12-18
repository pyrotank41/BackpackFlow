/**
 * SimpleChatNode - Example serializable node
 * 
 * Demonstrates PRD-003: Serialization Bridge implementation
 */

import { BackpackNode, NodeConfig as BaseNodeConfig, NodeContext } from '../backpack-node';
import { NodeConfig, SerializableNode, SerializableNodeClass } from '../../serialization/types';
import { DependencyContainer } from '../../serialization/dependency-container';

/**
 * SimpleChatNode - A basic chat node that can be serialized
 * 
 * Example usage:
 * ```typescript
 * // From code
 * const node = new SimpleChatNode(
 *     { id: 'chat-1', model: 'gpt-4', systemPrompt: 'You are helpful' },
 *     { namespace: 'main.chat', backpack }
 * );
 * 
 * // Serialize
 * const config = node.toConfig();
 * 
 * // Deserialize
 * const restored = SimpleChatNode.fromConfig(config, context, deps);
 * ```
 */
export class SimpleChatNode extends BackpackNode implements SerializableNode {
    static namespaceSegment = "chat";
    
    private model: string;
    private systemPrompt?: string;
    private temperature?: number;
    
    constructor(
        config: BaseNodeConfig & {
            model: string;
            systemPrompt?: string;
            temperature?: number;
        },
        context: NodeContext
    ) {
        super(config, context);
        this.model = config.model;
        this.systemPrompt = config.systemPrompt;
        this.temperature = config.temperature;
    }
    
    /**
     * Serialize to configuration
     */
    toConfig(): NodeConfig {
        return {
            type: 'SimpleChatNode',
            id: this.id,
            params: {
                model: this.model,
                systemPrompt: this.systemPrompt,
                temperature: this.temperature
            }
        };
    }
    
    /**
     * Deserialize from configuration
     */
    static fromConfig(
        config: NodeConfig,
        context: NodeContext,
        deps?: DependencyContainer
    ): SimpleChatNode {
        return new SimpleChatNode(
            {
                id: config.id,
                model: config.params.model,
                systemPrompt: config.params.systemPrompt,
                temperature: config.params.temperature
            },
            context
        );
    }
    
    // Node implementation
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        // Simulate chat
        const userQuery = this.unpack('userQuery');
        return {
            response: `Chat response to: ${userQuery}`,
            model: this.model
        };
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        this.pack('chatResponse', execRes);
        return undefined;
    }
}

