/**
 * DataAnalysisNode - Statistical outlier detection
 * 
 * Analyzes datasets to find outliers and generate insights.
 * Supports multiple metrics and configurable thresholds.
 */

import { BackpackNode, NodeConfig, NodeContext } from '../../src/nodes/backpack-node';

export interface DataAnalysisConfig extends NodeConfig {
    metric: string;
    threshold?: number; // multiplier for outlier detection (default: 10)
}

export interface DataAnalysisInput {
    data: any[];
    metric: string;
    threshold: number;
}

export interface Statistics {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    total: number;
    count: number;
}

export interface DataAnalysisOutput {
    outliers: any[];
    statistics: Statistics;
    insights: string[];
    threshold: number;
}

/**
 * DataAnalysisNode
 * 
 * Usage:
 * ```typescript
 * const analysisNode = flow.addNode(DataAnalysisNode, {
 *     id: 'analysis',
 *     metric: 'views',
 *     threshold: 10  // 10x median = outlier
 * });
 * 
 * // Pack data
 * backpack.pack('dataToAnalyze', videos);
 * 
 * // Run node
 * await analysisNode._run({});
 * 
 * // Get outliers
 * const outliers = backpack.unpack('outliers');
 * ```
 */
export class DataAnalysisNode extends BackpackNode {
    static namespaceSegment = "analysis";
    
    private metric: string;
    private threshold: number;
    
    constructor(config: DataAnalysisConfig, context: NodeContext) {
        super(config, context);
        
        this.metric = config.metric;
        this.threshold = config.threshold ?? 10;
    }
    
    /**
     * Preparation phase: Extract data from backpack
     */
    async prep(shared: any): Promise<DataAnalysisInput> {
        const data = this.unpackRequired<any[]>('dataToAnalyze');
        
        return {
            data,
            metric: this.metric,
            threshold: this.threshold
        };
    }
    
    /**
     * Execution phase: Analyze data and find outliers
     */
    async _exec(input: DataAnalysisInput): Promise<DataAnalysisOutput> {
        const { data, metric, threshold } = input;
        
        if (!data || data.length === 0) {
            throw new Error('No data to analyze');
        }
        
        // Extract metric values
        const values = data
            .map(item => this.extractMetricValue(item, metric))
            .filter(v => v !== null && v !== undefined && !isNaN(v)) as number[];
        
        if (values.length === 0) {
            throw new Error(`No valid values found for metric: ${metric}`);
        }
        
        // Calculate statistics
        const statistics = this.calculateStatistics(values);
        
        // Find outliers (values > threshold * median)
        const outlierThreshold = statistics.median * threshold;
        const outliers = data.filter(item => {
            const value = this.extractMetricValue(item, metric);
            return value !== null && value > outlierThreshold;
        });
        
        // Sort outliers by metric value (descending)
        outliers.sort((a, b) => {
            const valueA = this.extractMetricValue(a, metric) || 0;
            const valueB = this.extractMetricValue(b, metric) || 0;
            return valueB - valueA;
        });
        
        // Generate insights
        const insights = this.generateInsights(statistics, outliers.length, threshold, metric);
        
        return {
            outliers,
            statistics,
            insights,
            threshold: outlierThreshold
        };
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
    async post(backpack: any, shared: any, output: DataAnalysisOutput): Promise<string | undefined> {
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
            return 'no_outliers';
        }
        
        return 'complete';
    }
}

