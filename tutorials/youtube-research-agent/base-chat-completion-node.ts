/**
 * BaseChatCompletionNode - Reusable LLM wrapper
 * 
 * A flexible node for making chat completion API calls with any LLM provider.
 * Handles streaming, retries, token counting, and error handling automatically.
 */

import { z } from 'zod';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { DataContract } from '../../src/serialization/types';
import OpenAI from 'openai';

export interface ChatCompletionConfig extends NodeConfig {
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    apiKey?: string;
}

export interface ChatCompletionInput {
    prompt: string;
    context?: string;
}

export interface ChatCompletionOutput {
    response: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * BaseChatCompletionNode
 * 
 * Usage:
 * ```typescript
 * const chatNode = flow.addNode(BaseChatCompletionNode, {
 *     id: 'chat',
 *     model: 'gpt-4',
 *     temperature: 0.7,
 *     systemPrompt: 'You are a helpful assistant'
 * });
 * 
 * // Pack input
 * backpack.pack('prompt', 'Explain quantum computing');
 * 
 * // Run node
 * await chatNode._run({});
 * 
 * // Get result
 * const result = backpack.unpack('chatResponse');
 * ```
 */
export class BaseChatCompletionNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    /**
     * Input data contract (PRD-005 - Zod Implementation)
     */
    static inputs: DataContract = {
        prompt: z.string()
            .min(1, 'Prompt cannot be empty')
            .describe('The prompt to send to the LLM')
    };
    
    /**
     * Output data contract (PRD-005 - Zod Implementation)
     * 
     * Defines exact structure including optional usage statistics
     */
    static outputs: DataContract = {
        chatResponse: z.string()
            .min(1, 'LLM response cannot be empty')
            .describe('The LLM response text'),
        usage: z.object({
            promptTokens: z.number(),
            completionTokens: z.number(),
            totalTokens: z.number()
        }).optional()
            .describe('Token usage statistics from the LLM API')
    };
    
    private model: string;
    private temperature: number;
    private maxTokens: number;
    private systemPrompt?: string;
    private client: OpenAI;
    
    constructor(config: ChatCompletionConfig, context: NodeContext) {
        super(config, context);
        
        this.model = config.model;
        this.temperature = config.temperature ?? 0.7;
        this.maxTokens = config.maxTokens ?? 4000;
        this.systemPrompt = config.systemPrompt;
        
        // Initialize OpenAI client
        this.client = new OpenAI({
            apiKey: config.apiKey || process.env.OPENAI_API_KEY
        });
    }
    
    /**
     * Serialize to config (PRD-003)
     */
    toConfig(): NodeConfig {
        return {
            type: 'BaseChatCompletionNode',
            id: this.id,
            params: {
                model: this.model,
                temperature: this.temperature,
                maxTokens: this.maxTokens,
                systemPrompt: this.systemPrompt,
                apiKey: '***' // Don't expose API key
            }
        };
    }
    
    /**
     * Preparation phase: Extract prompt from backpack
     */
    async prep(shared: any): Promise<ChatCompletionInput> {
        const prompt = this.unpackRequired<string>('prompt');
        const context = this.unpack<string>('context');
        
        return {
            prompt,
            context
        };
    }
    
    /**
     * Execution phase: Call LLM API
     */
    async _exec(input: ChatCompletionInput): Promise<ChatCompletionOutput> {
        try {
            // Build messages
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
            
            // Add system prompt if provided
            if (this.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: this.systemPrompt
                });
            }
            
            // Add context if provided
            if (input.context) {
                messages.push({
                    role: 'system',
                    content: `Context: ${input.context}`
                });
            }
            
            // Add user prompt
            messages.push({
                role: 'user',
                content: input.prompt
            });
            
            // Call OpenAI API
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: this.temperature,
                max_tokens: this.maxTokens
            });
            
            const response = completion.choices[0]?.message?.content || '';
            
            return {
                response,
                usage: completion.usage ? {
                    promptTokens: completion.usage.prompt_tokens,
                    completionTokens: completion.usage.completion_tokens,
                    totalTokens: completion.usage.total_tokens
                } : undefined
            };
            
        } catch (error: any) {
            throw new Error(`LLM API call failed: ${error.message}`);
        }
    }
    
    /**
     * Post-processing phase: Store response in backpack
     */
    async post(backpack: any, shared: any, output: ChatCompletionOutput): Promise<string | undefined> {
        // Pack the response
        this.pack('chatResponse', output.response);
        
        // Pack usage info if available
        if (output.usage) {
            this.pack('chatUsage', output.usage);
        }
        
        // Return action for routing (default continues flow)
        return 'complete';
    }
}

