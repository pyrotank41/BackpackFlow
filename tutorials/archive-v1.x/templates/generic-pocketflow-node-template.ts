import { Node, Flow } from '../../../src/pocketflow';

/**
 * Generic PocketFlow Node Template
 * 
 * This template provides a starting point for creating any type of PocketFlow node
 * following the prep→exec→post pattern. It includes comprehensive documentation
 * and examples for common patterns.
 * 
 * The prep→exec→post pattern ensures:
 * - Clear separation of concerns
 * - Easy testing and debugging
 * - Reusable components
 * - Predictable data flow
 * 
 * Usage:
 * 1. Copy this template
 * 2. Define your SharedStorage type
 * 3. Implement prep() - data preparation
 * 4. Implement exec() - core business logic
 * 5. Implement post() - result handling
 */

// TODO: Define your storage type with the data your node needs
type SharedStorage = {
    // Input data (what your node consumes)
    input?: any;
    
    // Output data (what your node produces)
    output?: any;
    
    // Context data (shared across nodes)
    context?: any;
    
    // Configuration
    config?: any;
    
    // Add your specific fields here:
    // userMessage?: string;
    // searchResults?: any[];
    // processedData?: any;
    // metadata?: Record<string, any>;
}

// TODO: Define the type that prep() returns (input to exec())
type PreparedData = any; // Replace with your specific type

// TODO: Define the type that exec() returns (output from processing)
type ProcessingResult = any; // Replace with your specific type

/**
 * Generic PocketFlow Node
 * 
 * The three phases:
 * 1. prep() - Extract and transform data from SharedStorage
 * 2. exec() - Perform the main work (isolated from storage)
 * 3. post() - Handle results and update SharedStorage
 */
class GenericNode extends Node<SharedStorage> {
    private debug = process.env.DEBUG_NODE === 'true';
    
    // TODO: Add constructor parameters for configuration
    constructor(private config?: any) {
        super();
    }

    /**
     * 🎯 PREP Phase: Extract & Transform
     * 
     * Purpose:
     * - Extract data from SharedStorage
     * - Transform data into the format exec() needs
     * - Validate inputs
     * - Apply any pre-processing logic
     * 
     * Guidelines:
     * - Read from SharedStorage
     * - Can write to SharedStorage for state management
     * - Return clean, validated data for exec()
     * - Handle edge cases and validation
     */
    async prep(shared: SharedStorage): Promise<PreparedData> {
        if (this.debug) console.log('🔍 PREP: Starting data preparation');
        
        try {
            // TODO: Implement your data extraction logic
            // Examples:
            
            // 1. Extract and validate input
            // const input = shared.input;
            // if (!input) {
            //     throw new Error('Required input not found in shared storage');
            // }
            
            // 2. Transform data format
            // const transformedData = this.transformInput(input);
            
            // 3. Add context or metadata
            // const enrichedData = {
            //     ...transformedData,
            //     context: shared.context,
            //     timestamp: new Date()
            // };
            
            // 4. Validate prepared data
            // this.validatePreparedData(enrichedData);
            
            // TODO: Replace with your actual preparation logic
            const preparedData: PreparedData = {
                // Your prepared data structure
            };
            
            if (this.debug) console.log('🔍 PREP: Data preparation complete');
            
            return preparedData;
            
        } catch (error) {
            if (this.debug) console.error('❌ PREP: Data preparation failed');
            throw error;
        }
    }
    
    /**
     * ⚡ EXEC Phase: Core Processing
     * 
     * Purpose:
     * - Perform the main business logic
     * - Process the prepared data
     * - Execute external API calls
     * - Run computations or algorithms
     * 
     * Guidelines:
     * - Pure function (no SharedStorage access)
     * - Easy to test in isolation
     * - Focus on the core work
     * - Handle processing errors
     */
    async exec(data: PreparedData): Promise<ProcessingResult> {
        if (this.debug) console.log('🔍 EXEC: Starting core processing');
        
        try {
            // TODO: Implement your core business logic
            // Examples:
            
            // 1. API calls
            // const apiResult = await this.callExternalAPI(data);
            
            // 2. Data processing
            // const processedData = this.processData(data);
            
            // 3. Computations
            // const result = this.performCalculations(data);
            
            // 4. AI/ML operations
            // const prediction = await this.runModel(data);
            
            // 5. File operations
            // const fileContent = await this.processFile(data.filePath);
            
            // TODO: Replace with your actual processing logic
            const result: ProcessingResult = {
                // Your processing result
                success: true,
                data: data, // placeholder
                timestamp: new Date()
            };
            
            if (this.debug) console.log('🔍 EXEC: Core processing complete');
            
            return result;
            
        } catch (error) {
            if (this.debug) console.error('❌ EXEC: Core processing failed');
            throw error;
        }
    }
    
    /**
     * 💾 POST Phase: Result Handling
     * 
     * Purpose:
     * - Store results in SharedStorage
     * - Update application state
     * - Trigger side effects
     * - Determine next steps
     * 
     * Guidelines:
     * - Write results to SharedStorage
     * - Can access prep and exec results
     * - Handle success/error states
     * - Return next node name or undefined
     */
    async post(
        shared: SharedStorage, 
        prepResult: unknown, 
        execResult: unknown
    ): Promise<string | undefined> {
        if (this.debug) console.log('🔍 POST: Starting result handling');
        
        try {
            const typedExecResult = execResult as ProcessingResult;
            
            // TODO: Implement your result handling logic
            // Examples:
            
            // 1. Store primary results
            // shared.output = typedExecResult;
            
            // 2. Update context for future nodes
            // shared.context = {
            //     ...shared.context,
            //     lastProcessingResult: typedExecResult,
            //     processedAt: new Date()
            // };
            
            // 3. Trigger side effects
            // await this.saveToDatabase(typedExecResult);
            // await this.sendNotification(typedExecResult);
            
            // 4. Analytics and logging
            // this.logMetrics(prepResult, typedExecResult);
            
            // 5. Error handling
            // if (!typedExecResult.success) {
            //     shared.errors = shared.errors || [];
            //     shared.errors.push({
            //         node: 'GenericNode',
            //         error: 'Processing failed',
            //         timestamp: new Date()
            //     });
            // }
            
            if (this.debug) console.log('🔍 POST: Result handling complete');
            
            // TODO: Return next node name for multi-node flows, or undefined to end
            return undefined; // Ends the flow
            
            // Examples of conditional routing:
            // return typedExecResult.success ? 'nextNode' : 'errorHandler';
            // return shared.config?.nextNode;
            
        } catch (error) {
            if (this.debug) console.error('❌ POST: Result handling failed');
            throw error;
        }
    }
    
    // TODO: Add helper methods for your specific use case
    
    /**
     * Example helper: Validate input data
     */
    private validateInput(input: any): boolean {
        // Add your validation logic
        return true;
    }
    
    /**
     * Example helper: Transform data format
     */
    private transformData(input: any): any {
        // Add your transformation logic
        return input;
    }
    
    /**
     * Example helper: Log metrics and analytics
     */
    private logMetrics(prepResult: unknown, execResult: unknown): void {
        if (this.debug) {
            console.log('📊 Metrics:', {
                prepTime: 'timestamp',
                execTime: 'timestamp',
                success: true
            });
        }
    }
}

// 🚀 Example Usage and Testing
async function main() {
    console.log('🎓 Generic Node Template Example\n');

    try {
        // 1. Create your node with configuration
        const node = new GenericNode({
            // Your configuration options
        });
        
        // 2. Create a flow
        const flow = new Flow(node);
        
        // 3. Set up SharedStorage with test data
        const shared: SharedStorage = {
            input: "test input",
            context: { sessionId: 'test-123' },
            config: { debug: true }
            // Add your test data
        };
        
        console.log('🏃 Running the flow...');
        console.log('📝 Input data:', shared.input);
        console.log();

        // 4. Run the flow
        await flow.run(shared);
        
        // 5. Check results
        console.log('✅ Flow completed successfully!');
        console.log('📤 Output:', shared.output);
        console.log('🔄 Context:', shared.context);
        
        console.log('\n💡 Template Customization Ideas:');
        console.log('   • Add input validation in prep()');
        console.log('   • Implement error recovery in exec()');
        console.log('   • Add analytics in post()');
        console.log('   • Create conditional routing logic');
        console.log('   • Add configuration management');
        
    } catch (error) {
        console.error('\n❌ Flow execution failed:');
        console.error(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

// 🧪 Testing utilities
class NodeTester {
    /**
     * Test individual phases in isolation
     */
    static async testPhases<T>(node: GenericNode, storage: T) {
        console.log('🧪 Testing node phases individually...\n');
        
        try {
            // Test prep phase
            console.log('Testing prep()...');
            const prepResult = await node.prep(storage as any);
            console.log('✅ prep() result:', prepResult);
            
            // Test exec phase
            console.log('\nTesting exec()...');
            const execResult = await node.exec(prepResult);
            console.log('✅ exec() result:', execResult);
            
            // Test post phase
            console.log('\nTesting post()...');
            const postResult = await node.post(storage as any, prepResult, execResult);
            console.log('✅ post() result:', postResult);
            
            console.log('\n🎉 All phases tested successfully!');
            
        } catch (error) {
            console.error('❌ Phase testing failed:', error);
            throw error;
        }
    }
    
    /**
     * Performance testing
     */
    static async benchmarkNode<T>(node: GenericNode, storage: T, iterations: number = 100) {
        console.log(`🏃 Benchmarking node with ${iterations} iterations...\n`);
        
        const flow = new Flow(node);
        const times: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await flow.run(JSON.parse(JSON.stringify(storage))); // Deep copy
            const end = Date.now();
            times.push(end - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log('📊 Performance Results:');
        console.log(`   Average: ${avg.toFixed(2)}ms`);
        console.log(`   Min: ${min}ms`);
        console.log(`   Max: ${max}ms`);
    }
}

// TODO: Remove this when using as a template
if (require.main === module) {
    main().catch(console.error);
}

export { 
    GenericNode, 
    SharedStorage, 
    PreparedData, 
    ProcessingResult,
    NodeTester 
};
