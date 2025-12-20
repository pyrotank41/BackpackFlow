/**
 * YouTubeSearchNode - YouTube Data API v3 integration
 * 
 * Searches YouTube for videos and fetches detailed statistics.
 * Handles API rate limits and provides rich video metadata.
 */

import { z } from 'zod';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { DataContract } from '../../src/serialization/types';

export interface YouTubeSearchConfig extends NodeConfig {
    apiKey: string;
    maxResults?: number;
    publishedAfter?: Date;
}

export interface YouTubeSearchInput {
    query: string;
    publishedAfter?: Date;
}

/**
 * YouTube Video Schema (Zod)
 * 
 * Defines the shape and validation rules for YouTube video metadata
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
 * YouTube Video Type (inferred from Zod schema)
 * 
 * Single source of truth - type is automatically derived from schema
 */
export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

export interface YouTubeSearchOutput {
    videos: YouTubeVideo[];
    totalResults: number;
    query: string;
}

/**
 * YouTubeSearchNode
 * 
 * Usage:
 * ```typescript
 * const searchNode = flow.addNode(YouTubeSearchNode, {
 *     id: 'youtube-search',
 *     apiKey: process.env.YOUTUBE_API_KEY,
 *     maxResults: 50
 * });
 * 
 * // Pack query
 * backpack.pack('searchQuery', 'AI productivity tools');
 * 
 * // Run node
 * await searchNode._run({});
 * 
 * // Get results
 * const videos = backpack.unpack('searchResults');
 * ```
 */
export class YouTubeSearchNode extends BackpackNode {
    static namespaceSegment = "youtube.search";
    
    /**
     * Input data contract (PRD-005 - Zod Implementation)
     * 
     * Validates input data at runtime with detailed error messages
     */
    static inputs: DataContract = {
        searchQuery: z.string()
            .min(1)
            .describe('YouTube search query (e.g., "AI productivity tools")')
    };
    
    /**
     * Output data contract (PRD-005 - Zod Implementation)
     * 
     * Defines the exact shape of output data including nested object properties
     */
    static outputs: DataContract = {
        searchResults: z.array(YouTubeVideoSchema)
            .describe('Array of YouTube videos with full metadata (title, views, channel, likes, etc.)')
    };
    
    private apiKey: string;
    private maxResults: number;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';
    
    constructor(config: YouTubeSearchConfig, context: NodeContext) {
        super(config, context);
        
        this.apiKey = config.apiKey || process.env.YOUTUBE_API_KEY || '';
        this.maxResults = config.maxResults ?? 50;
        
        if (!this.apiKey) {
            throw new Error('YouTube API key is required');
        }
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
     * Preparation phase: Extract search query from backpack
     */
    async prep(shared: any): Promise<YouTubeSearchInput> {
        const query = this.unpackRequired<string>('searchQuery');
        const publishedAfter = this.unpack<Date>('publishedAfter');
        
        return {
            query,
            publishedAfter
        };
    }
    
    /**
     * Execution phase: Search YouTube and fetch video details
     */
    async _exec(input: YouTubeSearchInput): Promise<YouTubeSearchOutput> {
        try {
            // Step 1: Search for videos
            const searchResults = await this.searchVideos(input.query, input.publishedAfter);
            
            if (searchResults.length === 0) {
                return {
                    videos: [],
                    totalResults: 0,
                    query: input.query
                };
            }
            
            // Step 2: Get detailed statistics for each video
            const videoIds = searchResults.map(v => v.id);
            const videos = await this.getVideoDetails(videoIds);
            
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
    private async searchVideos(query: string, publishedAfter?: Date): Promise<Array<{id: string, title: string}>> {
        const params = new URLSearchParams({
            part: 'id,snippet',
            q: query,
            type: 'video',
            maxResults: this.maxResults.toString(),
            order: 'relevance',
            key: this.apiKey
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
    private async getVideoDetails(videoIds: string[]): Promise<YouTubeVideo[]> {
        // Batch requests (YouTube allows up to 50 video IDs per request)
        const videos: YouTubeVideo[] = [];
        
        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);
            const batchVideos = await this.fetchVideoBatch(batch);
            videos.push(...batchVideos);
        }
        
        return videos;
    }
    
    /**
     * Fetch a batch of video details
     */
    private async fetchVideoBatch(videoIds: string[]): Promise<YouTubeVideo[]> {
        const params = new URLSearchParams({
            part: 'snippet,statistics,contentDetails',
            id: videoIds.join(','),
            key: this.apiKey
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
    async post(backpack: any, shared: any, output: YouTubeSearchOutput): Promise<string | undefined> {
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

