"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  RefreshCcw, 
  MessageSquare, 
  Search, 
  Database, 
  Terminal, 
  Cpu, 
  Globe,
  Zap,
  Box,
  FileText,
  User
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  'llm': MessageSquare,
  'chat': MessageSquare,
  'search': Search,
  'api-client': Globe,
  'analysis': Database,
  'logic': Terminal,
  'agent': Cpu,
  'chat-input': User,
  'chat-output': FileText,
  'default': Zap
};

const StudioNode = ({ data, selected }: NodeProps) => {
  const { label, isActive, nodeType } = data as any;
  
  // Icon Resolution
  const getType = () => {
    const t = (nodeType || '').toLowerCase();
    if (t === 'chat-input' || t === 'chat-output') return t;
    if (t.includes('llm') || t.includes('chat')) return 'llm';
    if (t.includes('search')) return 'search';
    if (t.includes('api')) return 'api-client';
    if (t.includes('analysis')) return 'analysis';
    if (t.includes('logic') || t.includes('code')) return 'logic';
    return 'default';
  };

  const IconComponent = ICON_MAP[getType()] || Box;

  // Interaction State Styles
  const borderColor = isActive 
    ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
    : selected 
      ? "border-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]" 
      : "border-border/60";

  return (
    <div className="group relative flex flex-col items-center">
      {/* Target Handle (Input) - ANCHORED TO ICON BOX */}
      <div className={`w-14 h-14 bg-card rounded-2xl border-2 flex items-center justify-center transition-all duration-300 relative ${borderColor} ${isActive ? 'scale-105' : 'scale-100'}`}>
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-2 !h-2 !bg-primary border-2 border-background !left-[-5px] transition-all hover:!w-3 hover:!h-3" 
        />
        
        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />
        
        <IconComponent className={`w-6 h-6 ${isActive ? 'text-green-500 scale-110' : 'text-muted-foreground'} transition-all duration-500`} />

        {/* Floating Active Indicator */}
        {isActive && (
          <div className="absolute -top-1 -right-1">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 blur-sm animate-pulse opacity-50" />
              <div className="relative bg-green-500 rounded-full p-0.5 border border-background">
                <RefreshCcw className="w-2.5 h-2.5 animate-spin text-white" />
              </div>
            </div>
          </div>
        )}

        <Handle 
          type="source" 
          position={Position.Right} 
          className="!w-2 !h-2 !bg-primary border-2 border-background !right-[-5px] transition-all hover:!w-3 hover:!h-3" 
        />
      </div>

      {/* EXTERNAL LABELS: n8n Style */}
      <div className="mt-2 text-center w-32 px-1">
        <div className="font-bold text-[10px] text-foreground tracking-tight truncate leading-tight">
          {label as string}
        </div>
        <div className="text-[7px] text-muted-foreground uppercase font-medium tracking-normal opacity-50 mt-0.5 truncate">
          {nodeType || 'Processor'}
        </div>
      </div>
    </div>
  );
};

export default memo(StudioNode);
