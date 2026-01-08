/**
 * Agent Discovery - Scan for Studio-Compatible Agents
 * 
 * Discovers agents by scanning for metadata.json files and checking
 * for chat trigger compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AgentMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  triggers: Array<{
    type: string;
    inputType?: string;
    inputKey: string;
    description?: string;
  }>;
  outputs: Record<string, {
    outputKey: string;
    format: string;
    streaming?: boolean;
  }>;
  behavior?: {
    preserveState?: boolean;
    timeout?: number;
    retryable?: boolean;
  };
  tags?: string[];
  author?: string;
  requirements?: {
    env?: string[];
    dependencies?: string[];
  };
  
  // Internal (added by discovery)
  _path?: string;
  _type?: 'typescript' | 'json';
}

/**
 * Discover all Studio-compatible agents
 * 
 * @param dir - Directory to scan (default: ../tutorials)
 * @returns Array of agent metadata
 */
export async function discoverAgents(dir: string = '../tutorials'): Promise<AgentMetadata[]> {
  const agents: AgentMetadata[] = [];
  const tutorialsPath = path.resolve(process.cwd(), dir);
  
  // Check if tutorials directory exists
  if (!fs.existsSync(tutorialsPath)) {
    console.warn(`[Agent Discovery] Directory not found: ${tutorialsPath}`);
    return agents;
  }
  
  // Scan each subfolder
  const folders = fs.readdirSync(tutorialsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const folder of folders) {
    const metadataPath = path.join(tutorialsPath, folder, 'metadata.json');
    
    // Check if metadata.json exists
    if (!fs.existsSync(metadataPath)) {
      continue;
    }
    
    try {
      // Read and parse metadata
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      const metadata: AgentMetadata = JSON.parse(metadataContent);
      
      // Validate chat compatibility
      if (isChatCompatible(metadata)) {
        // Add internal metadata
        metadata._path = folder;
        const hasFlowJson = fs.existsSync(path.join(tutorialsPath, folder, 'flow.json'));
        const hasIndexTs = fs.existsSync(path.join(tutorialsPath, folder, 'index.ts')) || 
                           fs.existsSync(path.join(tutorialsPath, folder, `${folder}.ts`));
        
        metadata._type = hasFlowJson ? 'json' : (hasIndexTs ? 'typescript' : 'typescript');
        
        agents.push(metadata);
        console.log(`[Agent Discovery] ✓ Found chat-compatible agent: ${metadata.id}`);
      } else {
        console.log(`[Agent Discovery] ✗ Skipped non-chat agent: ${metadata.id}`);
      }
    } catch (error) {
      console.error(`[Agent Discovery] Error parsing ${metadataPath}:`, error);
    }
  }
  
  console.log(`[Agent Discovery] Found ${agents.length} chat-compatible agent(s)`);
  return agents;
}

/**
 * Check if agent is chat-compatible
 */
function isChatCompatible(metadata: AgentMetadata): boolean {
  if (!metadata.triggers || !Array.isArray(metadata.triggers)) {
    return false;
  }
  
  // Must have at least one chat trigger
  const hasChatTrigger = metadata.triggers.some(trigger => 
    trigger.type === 'chat' && 
    trigger.inputType === 'text' // Only text for now
  );
  
  // Must have chat output
  const hasChatOutput = metadata.outputs?.chat?.outputKey;
  
  return hasChatTrigger && !!hasChatOutput;
}

/**
 * Get agent by ID
 */
export async function getAgent(agentId: string, dir: string = '../tutorials'): Promise<AgentMetadata | null> {
  const agents = await discoverAgents(dir);
  return agents.find(agent => agent.id === agentId) || null;
}

/**
 * Get agents by tag
 */
export async function getAgentsByTag(tag: string, dir: string = '../tutorials'): Promise<AgentMetadata[]> {
  const agents = await discoverAgents(dir);
  return agents.filter(agent => agent.tags?.includes(tag));
}


