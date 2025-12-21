/**
 * SimpleDecisionNode - Example serializable decision node
 * 
 * Demonstrates PRD-003: Serialization Bridge with routing logic
 */

import { BackpackNode, NodeConfig as BaseNodeConfig, NodeContext } from '../backpack-node';
import { NodeConfig, SerializableNode } from '../../serialization/types';
import { DependencyContainer } from '../../serialization/dependency-container';

/**
 * SimpleDecisionNode - Routes based on backpack data
 * 
 * Example usage:
 * ```typescript
 * const node = new SimpleDecisionNode(
 *     { id: 'decision-1', decisionKey: 'userIntent' },
 *     { namespace: 'main.decision', backpack }
 * );
 * 
 * // Returns different actions based on backpack data
 * ```
 */
export class SimpleDecisionNode extends BackpackNode implements SerializableNode {
    static namespaceSegment = "decision";
    
    private decisionKey: string;
    private defaultAction: string;
    
    constructor(
        config: BaseNodeConfig & {
            decisionKey: string;
            defaultAction?: string;
        },
        context: NodeContext
    ) {
        super(config, context);
        this.decisionKey = config.decisionKey;
        this.defaultAction = config.defaultAction || 'default';
    }
    
    /**
     * Serialize to configuration
     */
    toConfig(): NodeConfig {
        return {
            type: 'SimpleDecisionNode',
            id: this.id,
            params: {
                decisionKey: this.decisionKey,
                defaultAction: this.defaultAction
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
    ): SimpleDecisionNode {
        return new SimpleDecisionNode(
            {
                id: config.id,
                decisionKey: config.params.decisionKey,
                defaultAction: config.params.defaultAction
            },
            context
        );
    }
    
    // Node implementation
    async prep(shared: any) {
        return shared;
    }
    
    async _exec(prepRes: any) {
        // Get decision value from backpack
        const decisionValue = this.unpack(this.decisionKey);
        return {
            decision: decisionValue || this.defaultAction
        };
    }
    
    async post(shared: any, prepRes: any, execRes: any) {
        // Return the decision as action
        return execRes.decision;
    }
}



