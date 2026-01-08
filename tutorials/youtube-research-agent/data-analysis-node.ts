/**
 * DataAnalysisNode - Statistical outlier detection
 * 
 * Analyzes datasets to find outliers and generate insights.
 * Supports multiple metrics and configurable thresholds.
 * 
 * REFACTORED: Minimal format with auto-generated metadata
 */

import { z } from 'zod';
import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';
import { DataContract } from '../../src/serialization/types';
import { YouTubeVideoSchema, YouTubeVideo } from './youtube-search-node';

/**
 * Statistics Schema (Zod)
 * 
 * Single source of truth for statistics data structure
 */
const StatisticsSchema = z.object({
    mean: z.number(),
    median: z.number(),
    stdDev: z.number(),
    min: z.number(),
    max: z.number(),
    total: z.number(),
    count: z.number()
});

export type Statistics = z.infer<typeof StatisticsSchema>;

/**
 * DataAnalysisNode - Minimal Format
 * 
 * UI metadata auto-generated from:
 * - Class name → "Data Analysis" (display name)
 * - "Analysis" in name → Category: "analysis", Icon: "📊"
 * - Config schema → UI properties
 * 
 * Usage:
 * ```typescript
 * const analysisNode = flow.addNode(DataAnalysisNode, {
 *     id: 'analysis',
 *     metric: 'views',
 *     threshold: 10  // 10x median = outlier
 * });
 * ```
 */
export class DataAnalysisNode extends BackpackNode {
    static namespaceSegment = "analysis";
    
    /**
     * Config Schema (AUTO-GENERATES UI PROPERTIES)
     * 
     * Define once, UI builds automatically:
     * - metric → Text input (required)
     * - threshold → Number input with min (optional, default: 10)
     */
    static config = z.object({
        metric: z.string()
            .default('views')
            .describe('Metric to analyze (e.g., "views", "likes", "comments")'),
        threshold: z.number()
            .min(1)
            .default(10)
            .describe('Outlier threshold multiplier (e.g., 10 = 10x channel average)')
    });
    
    /**
     * Input Contract (Backpack → Node)
     */
    static inputs: DataContract = {
        searchResults: z.array(YouTubeVideoSchema)
            .min(1, 'Need at least one video to analyze')
            .describe('Array of YouTube videos to analyze for breakthrough content')
    };
    
    /**
     * Output Contract (Node → Backpack)
     */
    static outputs: DataContract = {
        outliers: z.array(YouTubeVideoSchema)
            .describe('Videos identified as breakthrough content (performing above channel baseline)'),
        statistics: StatisticsSchema
            .describe('Statistical summary of video performance across all videos'),
        insights: z.array(z.string())
            .describe('Generated insights about patterns in breakthrough videos'),
        outlierThreshold: z.number()
            .describe('The threshold multiplier used to identify outliers'),
        prompt: z.string()
            .min(1)
            .describe('Generated prompt for LLM to analyze and explain the outliers')
    };
    
    // Runtime properties (loaded from config)
    private metric!: string;
    private threshold!: number;
    
    constructor(config: any, context: NodeContext) {
        super(config, context);
        
        const params = config.params || config;
        this.metric = params.metric || 'views';
        this.threshold = params.threshold ?? 10;
    }
    
    /**
     * Serialize to config (PRD-003)
     */
    toConfig(): NodeConfig {
        return {
            type: 'DataAnalysisNode',
            id: this.id,
            params: {
                metric: this.metric,
                threshold: this.threshold
            }
        };
    }
    
    /**
     * Preparation phase: Extract data from backpack
     */
    async prep(shared: any) {
        return {
            data: this.unpackRequired<any[]>('searchResults'),
            metric: this.metric,
            threshold: this.threshold
        };
    }
    
    /**
     * Execution phase: Analyze data and find outliers
     */
    async _exec(input: { data: any[]; metric: string; threshold: number }) {
        const { data, metric, threshold } = input;
        
        if (!data || data.length === 0) {
            throw new Error('No data to analyze');
        }
        
        // Extract metric values for overall statistics
        const values = data
            .map(item => this.extractMetricValue(item, metric))
            .filter(v => v !== null && v !== undefined && !isNaN(v)) as number[];
        
        if (values.length === 0) {
            throw new Error(`No valid values found for metric: ${metric}`);
        }
        
        // Calculate overall statistics
        const statistics = this.calculateStatistics(values);
        
        // Group videos by channel to calculate channel baselines
        const channelGroups = this.groupByChannel(data);
        
        // Calculate each channel's baseline (average views)
        // Only use channels with at least 2 videos for more reliable baselines
        const channelBaselines = new Map<string, number>();
        
        for (const [channelId, videos] of channelGroups.entries()) {
            const channelValues = videos
                .map(v => this.extractMetricValue(v, metric))
                .filter(v => v !== null) as number[];
            
            if (channelValues.length >= 2) {
                const avg = channelValues.reduce((sum, v) => sum + v, 0) / channelValues.length;
                channelBaselines.set(channelId, avg);
            }
        }
        
        // Find outliers: videos performing threshold * better than their channel's baseline
        const outliersWithScore: Array<{video: any, score: number, baseline: number}> = [];
        
        for (const item of data) {
            const value = this.extractMetricValue(item, metric);
            const channelId = item.channelId;
            const baseline = channelBaselines.get(channelId);
            
            if (value !== null && baseline && baseline > 0) {
                const score = value / baseline;
                
                // Video is an outlier if it's performing threshold * better than channel average
                if (score >= threshold) {
                    outliersWithScore.push({
                        video: item,
                        score,
                        baseline
                    });
                }
            }
        }
        
        // Sort outliers by score (descending)
        outliersWithScore.sort((a, b) => b.score - a.score);
        
        // Extract just the videos (but keep score for display)
        const outliers = outliersWithScore.map(o => ({
            ...o.video,
            outlierScore: o.score,
            channelBaseline: o.baseline
        }));
        
        // Generate insights
        const insights = this.generateInsights(statistics, outliers.length, threshold, metric);
        insights.push(`Outliers are videos performing ${threshold}x+ better than their channel's average ${metric}`);
        
        return {
            outliers,
            statistics,
            insights,
            threshold // This is now the multiplier, not an absolute value
        };
    }
    
    /**
     * Group videos by channel
     */
    private groupByChannel(data: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();
        
        for (const item of data) {
            const channelId = item.channelId || 'unknown';
            
            if (!groups.has(channelId)) {
                groups.set(channelId, []);
            }
            
            groups.get(channelId)!.push(item);
        }
        
        return groups;
    }
    
    /**
     * Extract metric value from an item
     */
    private extractMetricValue(item: any, metric: string): number | null {
        // Support nested properties (e.g., "stats.views")
        const parts = metric.split('.');
        let value = item;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }
        
        return typeof value === 'number' ? value : null;
    }
    
    /**
     * Calculate statistical measures
     */
    private calculateStatistics(values: number[]): Statistics {
        const sorted = [...values].sort((a, b) => a - b);
        const count = values.length;
        const total = values.reduce((sum, v) => sum + v, 0);
        const mean = total / count;
        
        // Median
        const mid = Math.floor(count / 2);
        const median = count % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        
        // Standard deviation
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / count;
        const stdDev = Math.sqrt(variance);
        
        return {
            mean,
            median,
            stdDev,
            min: sorted[0],
            max: sorted[count - 1],
            total,
            count
        };
    }
    
    /**
     * Generate human-readable insights
     */
    private generateInsights(stats: Statistics, outliersCount: number, threshold: number, metric: string): string[] {
        const insights: string[] = [];
        
        // Overall statistics
        insights.push(`Analyzed ${stats.count} items with metric: ${metric}`);
        insights.push(`Mean: ${this.formatNumber(stats.mean)}, Median: ${this.formatNumber(stats.median)}`);
        insights.push(`Range: ${this.formatNumber(stats.min)} to ${this.formatNumber(stats.max)}`);
        
        // Outlier analysis
        if (outliersCount > 0) {
            const percentage = ((outliersCount / stats.count) * 100).toFixed(1);
            insights.push(`Found ${outliersCount} outliers (${percentage}%) performing ${threshold}x+ above median`);
            insights.push(`Outlier threshold: ${this.formatNumber(stats.median * threshold)}`);
        } else {
            insights.push(`No outliers found above ${threshold}x median threshold`);
        }
        
        // Distribution insights
        const spread = stats.max / stats.median;
        if (spread > 100) {
            insights.push(`High variance detected: Top performer is ${spread.toFixed(1)}x the median`);
        }
        
        return insights;
    }
    
    /**
     * Format number for display
     */
    private formatNumber(num: number): string {
        if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(2)}M`;
        } else if (num >= 1_000) {
            return `${(num / 1_000).toFixed(2)}K`;
        }
        return num.toFixed(0);
    }
    
    /**
     * Post-processing phase: Store results in backpack
     */
    async post(backpack: any, shared: any, output: any): Promise<string | undefined> {
        // Pack outliers
        this.pack('outliers', output.outliers);
        
        // Pack statistics
        this.pack('statistics', output.statistics);
        
        // Pack insights
        this.pack('insights', output.insights);
        
        // Pack threshold used
        this.pack('outlierThreshold', output.threshold);
        
        // Return action based on results
        if (output.outliers.length === 0) {
            this.pack('prompt', 'No breakthrough videos were found for this query using channel-relative analysis. Summarize the general findings and explain what search parameters might be adjusted to find outliers.');
            return 'complete';
        }
        
        // Create prompt for LLM to explain why these videos are outliers
        const outliersText = output.outliers.map((item: any, index: number) => {
            const metricValue = this.extractMetricValue(item, this.metric) || 0;
            const score = item.outlierScore || 1;
            const baseline = item.channelBaseline || 0;
            return `${index + 1}. "${item.title}" by ${item.channelTitle}
   - Views: ${metricValue.toLocaleString()}
   - Channel's average views: ${baseline.toLocaleString()}
   - Performance: ${score.toFixed(1)}x better than channel average! 🚀
   - Likes: ${item.likes.toLocaleString()}`;
        }).join('\n\n');
        
        const prompt = `You are a YouTube research analyst. I found ${output.outliers.length} videos that are TRUE OUTLIERS - performing ${output.threshold}x+ better than their own channel's average performance.

IMPORTANT: These are not just popular videos. These are videos that broke through and performed exceptionally well RELATIVE TO THE CHANNEL'S TYPICAL PERFORMANCE. A small channel's viral video is just as interesting as a large channel's breakout hit.

Overall Dataset Statistics:
- Total videos analyzed: ${output.statistics.count}
- Average ${this.metric} (all videos): ${output.statistics.mean.toLocaleString()}
- Median ${this.metric} (all videos): ${output.statistics.median.toLocaleString()}

Outlier Videos:
${outliersText}

Please analyze why these videos are performing so well. What patterns do you notice in:
1. The topics/titles
2. The channels
3. The engagement metrics (views vs likes ratio)

Provide actionable insights for someone looking to create similar high-performing content.`;

        this.pack('prompt', prompt);
        
        return 'complete';
    }
}
