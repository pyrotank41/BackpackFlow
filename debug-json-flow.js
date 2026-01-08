
const { FlowLoader, DependencyContainer, Backpack, NodeRegistry } = require('./src');
const fs = require('fs');
const path = require('path');

async function debug() {
    try {
        console.log('Registering nodes...');
        // Manually register if needed
        const { YouTubeSearchNode } = require('./tutorials/youtube-research-agent/youtube-search-node');
        const { DataAnalysisNode } = require('./tutorials/youtube-research-agent/data-analysis-node');
        const { BaseChatCompletionNode } = require('./tutorials/youtube-research-agent/base-chat-completion-node');
        
        NodeRegistry.register('YouTubeSearchNode', YouTubeSearchNode);
        NodeRegistry.register('DataAnalysisNode', DataAnalysisNode);
        NodeRegistry.register('BaseChatCompletionNode', BaseChatCompletionNode);

        const flowPath = path.resolve(__dirname, 'tutorials/youtube-research-agent/flow.json');
        console.log('Loading flow from:', flowPath);
        const config = JSON.parse(fs.readFileSync(flowPath, 'utf8'));

        const loader = new FlowLoader();
        const nodeTypes = NodeRegistry.getTypes();
        for (const type of nodeTypes) {
            loader.register(type, NodeRegistry.get(type));
        }

        const backpack = new Backpack();
        const deps = new DependencyContainer();
        deps.register('backpack', backpack);

        console.log('Attempting to load flow...');
        const flow = await loader.loadFlow(config, deps);
        console.log('✓ Flow loaded successfully!');
        
    } catch (error) {
        console.error('FAILED TO LOAD FLOW:');
        console.error(error.message);
        if (error.cause) {
            console.error('CAUSE:', error.cause.message);
            console.error(error.cause.stack);
        } else {
            console.error(error.stack);
        }
    }
}

debug();
