"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Search, 
    LayoutGrid, 
    Network, 
    Files, 
    FileText, 
    ChevronRight, 
    Plus, 
    MoveHorizontal, 
    Database, 
    Bot, 
    MessageSquare, 
    Sliders, 
    Repeat, 
    Wand2,
    Compass
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface NodeMetadata {
  type: string;
  name: string;
  displayName: string;
  icon: string;
  category: string;
  description: string;
}

const CATEGORIES = [
  { id: 'io', name: 'Input & Output', icon: MoveHorizontal },
  { id: 'data', name: 'Data Sources', icon: Database },
  { id: 'models', name: 'Models & Agents', icon: Bot },
  { id: 'llm', name: 'LLM Operations', icon: MessageSquare },
  { id: 'files', name: 'Files', icon: FileText },
  { id: 'processing', name: 'Processing', icon: Sliders },
  { id: 'flow', name: 'Flow Control', icon: Repeat },
  { id: 'utilities', name: 'Utilities', icon: Wand2 },
];

interface NodePaletteProps {
    onWidthChange?: (width: number) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export function NodePalette({ onWidthChange, isCollapsed = false, onToggleCollapse }: NodePaletteProps) {
  const [nodes, setNodes] = useState<NodeMetadata[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('nodes');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = !isCollapsed;

  useEffect(() => {
    onWidthChange?.(isExpanded ? 320 : 48);
  }, [isExpanded, onWidthChange]);

  useEffect(() => {
    if (isExpanded && activeTab === 'search') {
        inputRef.current?.focus();
    }
  }, [activeTab, isExpanded]);

  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch("/api/nodes");
        const data = await res.json();
        
        // Inject Virtual I/O Nodes
        const virtualNodes: NodeMetadata[] = [
          {
            type: 'chat-input',
            name: 'chat-input',
            displayName: 'Chat Input',
            icon: '👤',
            category: 'Input & Output',
            description: 'The entry point for user messages.'
          },
          {
            type: 'chat-output',
            name: 'chat-output',
            displayName: 'Chat Output',
            icon: '📄',
            category: 'Input & Output',
            description: 'The final response sent back to the user.'
          }
        ];

        setNodes([...virtualNodes, ...(data.nodes || [])]);
      } catch (err) {
        console.error("Failed to fetch nodes:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchNodes();
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const getNodesByCategory = (categoryName: string) => {
    return nodes.filter(n => n.category.toLowerCase().includes(categoryName.toLowerCase().split(' ')[0]));
  };

  const filteredNodes = nodes.filter(
    (node) =>
      node.displayName.toLowerCase().includes(search.toLowerCase()) ||
      node.description.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTab = (tab: string) => {
    if (activeTab === tab) {
        onToggleCollapse?.();
    } else {
        setActiveTab(tab);
        if (isCollapsed) onToggleCollapse?.();
    }
  };

  return (
    <div className="flex h-full bg-background/20 backdrop-blur-3xl text-foreground transition-all duration-300">
      {/* 1. ICON RAIL (Mini Sidebar) */}
      <div className="w-12 border-r border-border/50 flex flex-col items-center py-4 gap-4 bg-muted/5 shrink-0">
        <button 
            className={`p-2 rounded-lg transition-colors ${isExpanded && activeTab === 'search' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`} 
            onClick={() => toggleTab('search')}
        >
            <Search className="w-5 h-5" />
        </button>
        <button 
            className={`p-2 rounded-lg transition-colors ${isExpanded && activeTab === 'nodes' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`} 
            onClick={() => toggleTab('nodes')}
        >
            <LayoutGrid className="w-5 h-5" />
        </button>
        
        {/* Hidden as per request */}
        <div className="hidden">
            <button className={`p-2 rounded-lg transition-colors ${activeTab === 'logic' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setActiveTab('logic')}>
                <Network className="w-5 h-5" />
            </button>
            <button className={`p-2 rounded-lg transition-colors ${activeTab === 'files' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => setActiveTab('files')}>
                <Files className="w-5 h-5" />
            </button>
        </div>

        <div className="mt-auto hidden">
             <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg">
                <FileText className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* 2. MAIN PALETTE PANEL */}
      <div className={`flex-1 flex flex-col min-w-0 border-l border-border/50 transition-all duration-300 ${!isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ width: isExpanded ? 'auto' : '0px', display: isExpanded ? 'flex' : 'none' }}>
        {/* Search Header */}
        <div className="p-4 space-y-4">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                    ref={inputRef}
                    placeholder="Search"
                    className="pl-9 bg-background/40 border-border/50 h-9 text-xs focus-visible:ring-primary/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                />
                {!isInputFocused && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 rounded border border-border/50">
                        /
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <span>Nodes</span>
                <Sliders className="w-3.5 h-3.5" />
            </div>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 px-2">
            {search ? (
                // Search Results View
                <div className="space-y-1 py-2">
                    {filteredNodes.length > 0 ? (
                        filteredNodes.map(node => (
                            <div
                                key={node.type}
                                draggable
                                onDragStart={(e) => onDragStart(e, node.type)}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-grab active:cursor-grabbing group transition-all"
                            >
                                <div className="w-8 h-8 rounded-md bg-muted/30 border border-border/50 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                                    {node.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold truncate">{node.displayName}</div>
                                    <div className="text-[9px] text-muted-foreground uppercase font-black opacity-50">{node.category}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-[10px] uppercase font-black opacity-30">No matches found</div>
                    )}
                </div>
            ) : (
                // Category View
                <div className="space-y-0.5 pb-4">
                    {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isExpanded = expandedCategory === cat.id;
                        const catNodes = getNodesByCategory(cat.name);

                        return (
                            <div key={cat.id} className="group">
                                <button 
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-muted/30 ${isExpanded ? 'bg-muted/20' : ''}`}
                                    onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                                >
                                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    <span className="flex-1 text-left text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{cat.name}</span>
                                    <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                </button>
                                
                                {isExpanded && (
                                    <div className="ml-9 mt-1 space-y-1 animate-in slide-in-from-top-1 duration-200">
                                        {catNodes.length > 0 ? (
                                            catNodes.map(node => (
                                                <div
                                                    key={node.type}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, node.type)}
                                                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-all group/node border border-transparent hover:border-border/30"
                                                >
                                                    <div className="w-7 h-7 shrink-0 rounded bg-muted/30 border border-border/50 flex items-center justify-center text-sm group-hover/node:scale-110 transition-transform">
                                                        {node.icon || '📦'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] font-bold text-foreground/80 group-hover/node:text-primary transition-colors truncate">{node.displayName}</div>
                                                        <div className="text-[8px] text-muted-foreground/60 truncate">{node.description}</div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-[9px] text-muted-foreground/30 italic py-1 px-2">No nodes in this category</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </ScrollArea>

        {/* Footer Area */}
        <div className="p-4 border-t border-border/50 bg-muted/5">
            <Button variant="ghost" className="w-full justify-start gap-3 h-10 px-3 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl" onClick={() => setActiveTab('discover')}>
                <Compass className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-bold">Discover more nodes</span>
            </Button>
            
            <button className="w-full mt-4 flex items-center gap-3 p-3 text-muted-foreground/60 hover:text-foreground transition-colors group">
                <Plus className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                <span className="text-[11px] font-black uppercase tracking-widest">New Custom Node</span>
            </button>
        </div>
      </div>
    </div>
  );
}
