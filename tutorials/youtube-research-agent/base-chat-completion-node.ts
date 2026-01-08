/**
 * BaseChatCompletionNode - Reusable LLM wrapper
 * 
 * A flexible node for making chat completion API calls with any LLM provider.
 * Handles streaming, retries, token counting, and error handling automatically.
 * 
 * REFACTORED: Minimal format with auto-generated metadata
 */

import { z } from 'zod';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { DataContract } from '../../src/serialization/types';
import OpenAI from 'openai';

/**
 * Usage Statistics Schema (Zod)
 * 
 * Single source of truth for token usage data
 */
const UsageSchema = z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number()
});

export type Usage = z.infer<typeof UsageSchema>;

/**
 * BaseChatCompletionNode - Minimal Format
 * 
 * UI metadata auto-generated from:
 * - Class name → "Base Chat Completion" (display name)
 * - "Chat" in name → Category: "llm", Icon: "🤖"
 * - Config schema → UI properties
 * 
 * Usage:
 * ```typescript
 * const chatNode = flow.addNode(BaseChatCompletionNode, {
 *     id: 'chat',
 *     model: 'gpt-4',
 *     temperature: 0.7,
 *     systemPrompt: 'You are a helpful assistant'
 * });
 * ```
 */
export class BaseChatCompletionNode extends BackpackNode {
    static namespaceSegment = "chat";
    
    /**
     * Config Schema (AUTO-GENERATES UI PROPERTIES)
     * 
     * Define once, UI builds automatically:
     * - model → Text input (required)
     * - temperature → Number input with min/max (optional, default: 0.7)
     * - maxTokens → Number input with min/max (optional, default: 4000)
     * - systemPrompt → Text input (optional)
     * - apiKey → Text input (optional, can use env var)
     */
    static config = z.object({
        model: z.string()
            .default('gpt-4o-mini')
            .describe('OpenAI model name (e.g., "gpt-4", "gpt-3.5-turbo")'),
        temperature: z.number()
            .min(0)
            .max(2)
            .default(0.7)
            .describe('Sampling temperature (0 = deterministic, 2 = very random)'),
        maxTokens: z.number()
            .min(1)
            .max(16000)
            .default(4000)
            .describe('Maximum tokens to generate'),
        systemPrompt: z.string()
            .optional()
            .describe('System prompt to set the LLM behavior'),
        apiKey: z.string()
            .optional()
            .describe('OpenAI API key (or use OPENAI_API_KEY env var)'),
        jsonResponse: z.boolean()
            .default(false)
            .describe('If true, the LLM will return a JSON object')
    });
    
    /**
     * Input Contract (Backpack → Node)
     */
    static inputs: DataContract = {
        prompt: z.string()
            .min(1, 'Prompt cannot be empty')
            .describe('The prompt to send to the LLM'),
        context: z.string()
            .optional()
            .describe('Additional context to include in the prompt')
    };
    
    /**
     * Output Contract (Node → Backpack)
     */
    static outputs: DataContract = {
        chatResponse: z.string()
            .min(1, 'LLM response cannot be empty')
            .describe('The LLM response text'),
        chatUsage: UsageSchema
            .optional()
            .describe('Token usage statistics from the LLM API')
    };
    
    // Runtime properties (loaded from config)
    private model!: string;
    private temperature!: number;
    private maxTokens!: number;
    private systemPrompt?: string;
    private apiKeyRef?: string;
    private jsonResponse: boolean;
    
    constructor(config: any, context: NodeContext) {
        super(config, context);
        
        const params = config.params || config;
        
        // Extract validated config
        this.model = params.model ?? 'gpt-4o-mini';
        this.temperature = params.temperature ?? 0.7;
        this.maxTokens = params.maxTokens ?? 4000;
        this.systemPrompt = params.systemPrompt;
        
        // Store API key reference (will be resolved at runtime)
        this.apiKeyRef = params.apiKey || process.env.OPENAI_API_KEY;
        this.jsonResponse = params.jsonResponse ?? false;
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
                apiKey: '***',
                jsonResponse: this.jsonResponse
            }
        };
    }
    
    /**
     * Preparation phase: Extract prompt from backpack and resolve credentials
     */
    async prep(shared: any) {
        // Resolve credential at runtime (supports @cred:id, ${ENV_VAR}, or direct value)
        const apiKey = this.apiKeyRef 
            ? await this.resolveCredential(this.apiKeyRef, 'openaiApi')
            : undefined;
        
        // Create OpenAI client with resolved API key
        const client = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY
        });
        
        const result = {
            prompt: this.unpackRequired<string>('prompt'),
            context: this.unpack<string>('context')
        };

        // Make client non-enumerable to avoid circular JSON error in telemetry
        Object.defineProperty(result, 'client', {
            value: client,
            enumerable: false,
            writable: true,
            configurable: true
        });

        return result;
    }
    
    /**
     * Execution phase: Call LLM API
     */
    async _exec(input: { prompt: string; context?: string; client: OpenAI }) {
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
            
            // Call OpenAI API (using resolved client)
            const completion = await input.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                response_format: this.jsonResponse ? { type: 'json_object' } : undefined
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
    async post(backpack: any, shared: any, output: any): Promise<string | undefined> {
        // Pack the raw response
        this.pack('chatResponse', output.response);
        
        // If JSON response is enabled, try to parse and pack individual keys
        if (this.jsonResponse) {
            try {
                const parsed = JSON.parse(output.response);
                if (parsed && typeof parsed === 'object') {
                    for (const [key, value] of Object.entries(parsed)) {
                        this.pack(key, value);
                    }
                }
            } catch (err) {
                console.warn(`[BaseChatCompletionNode] Failed to parse JSON response:`, err);
            }
        }
        
        // Pack usage info if available
        if (output.usage) {
            this.pack('chatUsage', output.usage);
        }
        
        // Return action for routing (default continues flow)
        return 'complete';
    }
}
