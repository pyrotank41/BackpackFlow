/**
 * YouTubeSearchNode - YouTube Data API v3 integration
 * 
 * Searches YouTube for videos and fetches detailed statistics.
 * Handles API rate limits and provides rich video metadata.
 * 
 * REFACTORED: Minimal format with auto-generated metadata
 */

import { z } from 'zod';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { DataContract } from '../../src/serialization/types';

/**
 * YouTube Video Schema (Zod)
 * 
 * Single source of truth for video data structure
 */
export const YouTubeVideoSchema = z.object({
    id: z.string(),
    title: z.string(),
    channelTitle: z.string(),
    channelId: z.string(),
    views: z.number(),
    likes: z.number(),
    comments: z.number(),
    publishedAt: z.date(),
    duration: z.string(),
    thumbnail: z.string().url(),
    url: z.string().url(),
    description: z.string()
});

/**
 * YouTube Video Type (auto-inferred from Zod)
 */
export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

/**
 * YouTubeSearchNode - Minimal Format
 * 
 * UI metadata auto-generated from:
 * - Class name → "YouTube Search" (display name)
 * - "YouTube" in name → Category: "api-client", Icon: "🎥"
 * - Config schema → UI properties
 * 
 * Usage:
 * ```typescript
 * const searchNode = flow.addNode(YouTubeSearchNode, {
 *     id: 'youtube-search',
 *     apiKey: process.env.YOUTUBE_API_KEY,
 *     maxResults: 50
 * });
 * ```
 */
export class YouTubeSearchNode extends BackpackNode {
    static namespaceSegment = "youtube.search";
    
    /**
     * Config Schema (AUTO-GENERATES UI PROPERTIES)
     * 
     * Define once, UI builds automatically:
     * - apiKey → Text input (required)
     * - maxResults → Number input with min/max (optional, default: 50)
     */
    static config = z.object({
        apiKey: z.string()
            .optional()
            .describe('YouTube Data API v3 key'),
        maxResults: z.number()
            .min(1)
            .max(100)
            .default(50)
            .describe('Maximum number of videos to fetch')
    });
    
    /**
     * Input Contract (Backpack → Node)
     */
    static inputs: DataContract = {
        searchQuery: z.string()
            .min(1)
            .describe('YouTube search query (e.g., "AI productivity tools")'),
        publishedAfter: z.preprocess(
            (val) => (val === null || val === '' ? undefined : val),
            z.coerce.date().optional()
        ).describe('Filter videos published after this date')
    };
    
    /**
     * Output Contract (Node → Backpack)
     */
    static outputs: DataContract = {
        searchResults: z.array(YouTubeVideoSchema)
            .describe('Array of YouTube videos with full metadata'),
        searchMetadata: z.object({
            query: z.string(),
            totalResults: z.number(),
            timestamp: z.date()
        }).describe('Search metadata')
    };
    
    // Runtime properties (loaded from config)
    private apiKeyRef!: string; // Store credential reference, not the actual key
    private maxResults!: number;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';
    
    constructor(config: any, context: NodeContext) {
        super(config, context);
        
        const params = config.params || config;
        this.apiKeyRef = params.apiKey || process.env.YOUTUBE_API_KEY || '';
        this.maxResults = params.maxResults ?? 50;
    }
    
    /**
     * Serialize to config (PRD-003)
     */
    toConfig(): NodeConfig {
        return {
            type: 'YouTubeSearchNode',
            id: this.id,
            params: {
                apiKey: '***', // Don't expose API key in serialization
                maxResults: this.maxResults
            }
        };
    }
    
    /**
     * Preparation phase: Extract inputs from backpack and resolve credentials
     */
    async prep(shared: any) {
        // Resolve credential at runtime (supports @cred:id, ${ENV_VAR}, or direct value)
        const apiKey = await this.resolveCredential(this.apiKeyRef, 'youtubeApi');
        
        return {
            query: this.unpackRequired<string>('searchQuery'),
            publishedAfter: this.unpack<Date>('publishedAfter'),
            apiKey // Include resolved API key in prep result
        };
    }
    
    /**
     * Execution phase: Search YouTube and fetch video details
     */
    async _exec(input: { query: string; publishedAfter?: Date; apiKey: string }) {
        try {
            // Step 1: Search for videos (using resolved API key)
            const searchResults = await this.searchVideos(input.query, input.apiKey, input.publishedAfter);
            
            if (searchResults.length === 0) {
                return {
                    videos: [],
                    totalResults: 0,
                    query: input.query
                };
            }
            
            // Step 2: Get detailed statistics for each video
            const videoIds = searchResults.map(v => v.id);
            const videos = await this.getVideoDetails(videoIds, input.apiKey);
            
            return {
                videos,
                totalResults: videos.length,
                query: input.query
            };
            
        } catch (error: any) {
            throw new Error(`YouTube API error: ${error.message}`);
        }
    }
    
    /**
     * Search for videos using YouTube Search API
     */
    private async searchVideos(query: string, apiKey: string, publishedAfter?: Date): Promise<Array<{id: string, title: string}>> {
        const params = new URLSearchParams({
            part: 'id,snippet',
            q: query,
            type: 'video',
            maxResults: this.maxResults.toString(),
            order: 'relevance',
            key: apiKey
        });
        
        if (publishedAfter) {
            params.append('publishedAfter', publishedAfter.toISOString());
        }
        
        const response = await fetch(`${this.baseUrl}/search?${params}`);
        
        if (!response.ok) {
            const error = await response.json() as any;
            throw new Error(error.error?.message || 'YouTube search failed');
        }
        
        const data = await response.json() as any;
        
        return data.items?.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title
        })) || [];
    }
    
    /**
     * Get detailed statistics for videos
     */
    private async getVideoDetails(videoIds: string[], apiKey: string): Promise<YouTubeVideo[]> {
        // Batch requests (YouTube allows up to 50 video IDs per request)
        const videos: YouTubeVideo[] = [];
        
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const batchVideos = await this.fetchVideoBatch(batch, apiKey);
            videos.push(...batchVideos);
        }
        
        return videos;
    }
    
    /**
     * Fetch a batch of video details
     */
    private async fetchVideoBatch(videoIds: string[], apiKey: string): Promise<YouTubeVideo[]> {
        const params = new URLSearchParams({
            part: 'snippet,statistics,contentDetails',
            id: videoIds.join(','),
            key: apiKey
        });
        
        const response = await fetch(`${this.baseUrl}/videos?${params}`);
        
        if (!response.ok) {
            const error = await response.json() as any;
            throw new Error(error.error?.message || 'YouTube videos fetch failed');
        }
        
        const data = await response.json() as any;
        
        return data.items?.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            views: parseInt(item.statistics.viewCount || '0'),
            likes: parseInt(item.statistics.likeCount || '0'),
            comments: parseInt(item.statistics.commentCount || '0'),
            publishedAt: new Date(item.snippet.publishedAt),
            duration: item.contentDetails.duration,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            url: `https://www.youtube.com/watch?v=${item.id}`,
            description: item.snippet.description
        })) || [];
    }
    
    /**
     * Post-processing phase: Store results in backpack
     */
    async post(backpack: any, shared: any, output: any): Promise<string | undefined> {
        // Pack search results
        this.pack('searchResults', output.videos);
        
        // Pack metadata
        this.pack('searchMetadata', {
            query: output.query,
            totalResults: output.totalResults,
            timestamp: new Date()
        });
        
        // Return action based on results
        if (output.videos.length === 0) {
            return 'no_results';
        }
        
        return 'complete';
    }
}
