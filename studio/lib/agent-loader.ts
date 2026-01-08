/**
 * Agent Loader - Load and run agents
 * 
 * Loads agent node classes from the registry and creates flows with Backpack.
 */

import { BackpackFlow, Backpack, FlowLoader, EventStreamer, DependencyContainer } from 'backpackflow';
import { NodeRegistry } from '@backpackflow/nodes/registry';
import type { AgentMetadata } from './agent-discovery';
import { getAgentNodeClass } from './agent-registry';
import * as fs from 'fs';
import * as path from 'path';
import { registerYouTubeAgentNodes } from '@tutorials/youtube-research-agent/register-nodes';

/**
 * Load and instantiate agent with Backpack
 */
export async function loadAgent(
  metadata: AgentMetadata,
  backpack: Backpack,
  eventStreamer?: EventStreamer
): Promise<BackpackFlow> {
  try {
    // Ensure nodes are registered for the loader
    registerYouTubeAgentNodes();

    if (metadata._type === 'json' && metadata._path) {
      console.log(`[Agent Loader] Loading JSON-defined agent: ${metadata.id}`);
      
      const tutorialsPath = path.resolve(process.cwd(), '../tutorials');
      const flowPath = path.join(tutorialsPath, metadata._path, 'flow.json');
      
      if (!fs.existsSync(flowPath)) {
        throw new Error(`Flow config not found at ${flowPath}`);
      }
      
      const config = JSON.parse(fs.readFileSync(flowPath, 'utf8'));
      
      const loader = new FlowLoader();
      // Register all available nodes to the loader
      const nodeTypes = NodeRegistry.getTypes();
      for (const type of nodeTypes) {
        loader.register(type, NodeRegistry.get(type) as any);
      }
      
      const deps = new DependencyContainer();
      deps.register('backpack', backpack);
      if (eventStreamer) {
        deps.register('eventStreamer', eventStreamer);
      }
      
      const flow = await loader.loadFlow(config, deps);
      console.log(`[Agent Loader] ✓ Loaded JSON agent: ${metadata.id}`);
      return flow as any;
    }

    // Fallback: Legacy TypeScript composite nodes
    const NodeClass = getAgentNodeClass(metadata.id);
    
    const flow = new BackpackFlow({
      namespace: metadata.id,
      backpack: backpack,
      eventStreamer: eventStreamer
    });
    
    const agentNode = flow.addNode(NodeClass as any, {
      id: metadata.id
    });
    
    flow.setEntryNode(agentNode);
    
    console.log(`[Agent Loader] ✓ Loaded TS agent: ${metadata.id}`);
    return flow;
  } catch (error) {
    console.error(`[Agent Loader] Failed to load agent ${metadata.id}:`, error);
    throw new Error(`Failed to load agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the flow graph for an agent
 */
export async function getAgentGraph(metadata: AgentMetadata): Promise<any> {
  const backpack = new Backpack();
  const flow = await loadAgent(metadata, backpack);
  
  // Try to initialize the internal flow if it's a composite node
  const entryNode = (flow as any).entryNode;
  if (entryNode && typeof entryNode.setupInternalFlow === 'function') {
    entryNode.setupInternalFlow();
  } else if (entryNode && typeof entryNode._exec === 'function') {
    // If it doesn't have setupInternalFlow, we might need to 
    // run it once with a dry-run flag or just accept it might be empty
    // until we improve the agent convention.
  }
  
  const loader = new FlowLoader();
  return loader.exportFlow(flow);
}

/**
 * Prepare agent input
 * 
 * Packs user message to the agent's declared inputKey
 */
export function prepareInput(
  backpack: Backpack,
  metadata: AgentMetadata,
  userMessage: string
): void {
  // Find chat trigger
  const chatTrigger = metadata.triggers.find(t => t.type === 'chat');
  if (!chatTrigger) {
    throw new Error('No chat trigger found');
  }
  
  // Pack input to declared key
  backpack.pack(chatTrigger.inputKey, userMessage, {
    nodeId: 'studio',
    nodeName: 'Backpack Studio UI',
    tags: ['user-input', 'chat']
  });
}

/**
 * Read agent output
 * 
 * Reads response from the agent's declared outputKey
 */
export function readOutput(
  backpack: Backpack,
  metadata: AgentMetadata
): string {
  // Read output from declared key
  const output = backpack.unpack(metadata.outputs.chat.outputKey);
  
  if (output === undefined) {
    throw new Error(`Agent did not produce output at key: ${metadata.outputs.chat.outputKey}`);
  }
  
  return String(output);
}


