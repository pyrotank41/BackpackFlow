"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import FlowGraph from "@/components/FlowGraph";
import { NodePalette } from "@/components/palette/NodePalette";
import NodePropertyPanel from "@/components/NodePropertyPanel";
import { WorkbenchSidebar } from "@/components/WorkbenchSidebar";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
    ChevronLeft,
    RefreshCcw,
    MessageSquare,
    Box,
    Code,
    Eye,
} from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface BackpackEvent {
    id: string;
    type: string;
    timestamp: number;
    nodeId: string;
    payload?: Record<string, unknown>;
}

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const agentId = params.agentId as string;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [agentName, setAgentName] = useState("Agent");
    const [sessionId, setSessionId] = useState("");
    const [viewMode, setViewMode] = useState<"chat" | "blueprint">("blueprint");
    const [graphViewMode, setGraphViewMode] = useState<"visual" | "json">("visual");
    const [realtimeEvents, setRealtimeEvents] = useState<BackpackEvent[]>([]);
    const [sidebarWidth, setSidebarWidth] = useState(480);
    const [selectedNode, setSelectedNode] = useState<any>(null);
    const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
    const [backpackState, setBackpackState] = useState<Record<string, any> | null>(null);
    const [loadingState, setLoadingState] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
    const [graphConfig, setGraphConfig] = useState<any>(null);
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(320);
    const [isInitialized, setIsInitialized] = useState(false);

    // Persist sidebar states
    useEffect(() => {
        const savedRight = localStorage.getItem("rightSidebarCollapsed");
        const savedLeft = localStorage.getItem("leftSidebarCollapsed");
        
        if (savedRight !== null) {
            const collapsed = savedRight === "true";
            setIsSidebarCollapsed(collapsed);
            setSidebarWidth(collapsed ? 56 : 480);
        }
        if (savedLeft !== null) {
            setIsLeftSidebarCollapsed(savedLeft === "true");
        }
        setIsInitialized(true);
    }, []);

    const toggleSidebar = () => {
        const newState = !isSidebarCollapsed;
        setIsSidebarCollapsed(newState);
        localStorage.setItem("rightSidebarCollapsed", String(newState));
        if (newState) {
            setSidebarWidth(56);
        } else {
            setSidebarWidth(480);
        }
    };

    const toggleLeftSidebar = () => {
        const newState = !isLeftSidebarCollapsed;
        setIsLeftSidebarCollapsed(newState);
        localStorage.setItem("leftSidebarCollapsed", String(newState));
    };

    useEffect(() => {
        if (!sessionId) {
            setSessionId(`session-${Date.now()}`);
        }
    }, [sessionId]);

    useEffect(() => {
        const fetchGraphConfig = async () => {
            try {
                const res = await fetch(`/api/agents/${agentId}/graph`);
                const data = await res.json();
                if (data.success && data.graph) {
                    setGraphConfig(data.graph);
                }
            } catch (err) {
                console.error("Failed to fetch graph config:", err);
            }
        };
        fetchGraphConfig();
    }, [agentId]);

    useEffect(() => {
        if (!sessionId) return;
        const eventSource = new EventSource(`/api/events/${sessionId}`);
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setRealtimeEvents((prev) => [...prev, data]);
                if (data.type === 'node_start') {
                    setActiveNodeIds(prev => [...prev, data.nodeId]);
                } else if (data.type === 'node_end' || data.type === 'error') {
                    setActiveNodeIds(prev => prev.filter(id => id !== data.nodeId));
                }
            } catch (err) {
                console.error("Failed to parse SSE event:", err);
            }
        };
        eventSource.onerror = (err) => {
            console.error("SSE Connection Error:", err);
            eventSource.close();
        };
        return () => eventSource.close();
    }, [sessionId]);

    const clearSession = () => {
        setMessages([]);
        setRealtimeEvents([]);
        setSessionId(`session-${Date.now()}`);
    };

    const sendMessage = async (content: string) => {
        if (!content.trim() || loading) return;
        setLoading(true);
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId, message: content, sessionId }),
            });
            const data = await response.json();
            if (data.success) {
                setMessages(data.conversation);
                setAgentName(data.metadata.agentName);
            }
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBackpackState = async () => {
        if (!sessionId) return;
        setLoadingState(true);
        try {
            const res = await fetch(`/api/session/${sessionId}/state`);
            const data = await res.json();
            if (data.success) setBackpackState(data.state);
        } catch (e) {
            console.error("Failed to fetch state", e);
        } finally {
            setLoadingState(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
            <header className="bg-background/40 backdrop-blur-2xl border-b h-14 flex items-center px-4 z-30 shrink-0">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="text-[10px] font-bold uppercase tracking-wider">
                            <ChevronLeft className="w-3 h-3 mr-1" /> Exit
                        </Button>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold tracking-tight">{agentName}</h1>
                            <Badge variant="outline" className="text-[8px] h-4">v2.1</Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button 
                            variant={viewMode === "blueprint" ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setViewMode(viewMode === "blueprint" ? "chat" : "blueprint")}
                            className="text-[9px] h-7 px-3 font-bold uppercase tracking-wider"
                        >
                            {viewMode === "chat" ? <Box className="w-3 h-3 mr-1.5" /> : <MessageSquare className="w-3 h-3 mr-1.5" />}
                            {viewMode === "chat" ? "Blueprint" : "Focus"}
                        </Button>
                        {viewMode === "blueprint" && (
                            <Button 
                                variant={graphViewMode === "visual" ? "default" : "ghost"} 
                                size="sm" 
                                onClick={() => setGraphViewMode(graphViewMode === "visual" ? "json" : "visual")}
                                className="text-[9px] h-7 px-3 font-bold uppercase tracking-wider"
                            >
                                {graphViewMode === "visual" ? <Code className="w-3 h-3 mr-1.5" /> : <Eye className="w-3 h-3 mr-1.5" />}
                                {graphViewMode === "visual" ? "JSON" : "Visual"}
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={clearSession} className="text-[9px] h-7 px-3 uppercase font-bold">
                            <RefreshCcw className="w-3 h-3 mr-1.5" /> Reset
                        </Button>
                        <ThemeSwitcher />
                    </div>
                </div>
            </header>

            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {!isInitialized ? (
                    <div className="absolute inset-0 bg-background/5 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
                    </div>
                ) : (
                    <>
                        {/* 1. LEFT SIDEBAR */}
                {viewMode === "blueprint" && (
                    <div 
                        style={{ width: isLeftSidebarCollapsed ? '48px' : `${leftSidebarWidth}px` }}
                        className="shrink-0 border-r transition-all duration-300 ease-in-out pointer-events-auto overflow-hidden relative z-20"
                    >
                         <NodePalette 
                            onWidthChange={setLeftSidebarWidth} 
                            isCollapsed={isLeftSidebarCollapsed}
                            onToggleCollapse={toggleLeftSidebar}
                         />
                    </div>
                )}

                {/* 2. CENTER CONTENT (Graph/JSON + Overlays) */}
                <div className="flex-1 relative min-w-0 bg-background/5">
                    {/* The Graph or JSON view (Now bounded by sidebars) */}
                    <div className="absolute inset-0 z-0">
                        {graphViewMode === "visual" ? (
                            <FlowGraph
                                agentId={agentId}
                                activeNodeIds={activeNodeIds}
                                onNodeSelect={(nodeId, nodeData) => setSelectedNode({ ...nodeData, id: nodeId })}
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center p-8">
                                <div className="w-full max-w-6xl h-full bg-background/20 backdrop-blur-3xl border border-border rounded-2xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto">
                                    <div className="h-14 border-b border-border/50 flex items-center px-6 bg-muted/5 shrink-0">
                                        <Code className="w-4 h-4 mr-2 text-primary" />
                                        <h2 className="text-sm font-bold text-foreground">Graph Configuration</h2>
                                        <span className="ml-2 text-xs text-muted-foreground font-mono">JSON</span>
                                    </div>
                                    <div className="flex-1 p-4">
                                        <div className="h-full rounded-xl overflow-hidden border border-border/50">
                                            <Editor
                                                height="100%"
                                                defaultLanguage="json"
                                                value={graphConfig ? JSON.stringify(graphConfig, null, 2) : "// Loading..."}
                                                theme="backpack-dark"
                                                beforeMount={(monaco) => {
                                                    monaco.editor.defineTheme('backpack-dark', {
                                                        base: 'vs-dark',
                                                        inherit: true,
                                                        rules: [
                                                            { token: 'string.key.json', foreground: '8B5CF6' },
                                                            { token: 'string.value.json', foreground: '10B981' },
                                                            { token: 'number', foreground: 'F59E0B' },
                                                            { token: 'keyword', foreground: 'EC4899' },
                                                            { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
                                                        ],
                                                        colors: {
                                                            'editor.background': '#0a0a0a',
                                                            'editor.foreground': '#e5e7eb',
                                                            'editor.lineHighlightBackground': '#1a1a1a',
                                                            'editorLineNumber.foreground': '#6b7280',
                                                            'editorLineNumber.activeForeground': '#8b5cf6',
                                                            'editor.selectionBackground': '#8b5cf620',
                                                            'editor.inactiveSelectionBackground': '#8b5cf610',
                                                            'editorCursor.foreground': '#8b5cf6',
                                                            'editorWhitespace.foreground': '#374151',
                                                            'editorIndentGuide.background': '#1f2937',
                                                            'editorIndentGuide.activeBackground': '#374151',
                                                        }
                                                    });
                                                }}
                                                options={{
                                                    readOnly: true,
                                                    minimap: { enabled: false },
                                                    fontSize: 13,
                                                    lineNumbers: "on",
                                                    scrollBeyondLastLine: false,
                                                    automaticLayout: true,
                                                    tabSize: 2,
                                                    padding: { top: 16, bottom: 16 },
                                                    smoothScrolling: true,
                                                    cursorBlinking: "smooth",
                                                    renderLineHighlight: "none",
                                                    overviewRulerBorder: false,
                                                    hideCursorInOverviewRuler: true,
                                                    wordWrap: "on",
                                                    wrappingIndent: "indent",
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* OVERLAYS (Relative to the center area) */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        {/* Focus Mode Chat Overlay */}
                        {viewMode === "chat" && (
                            <div className="absolute inset-0 flex items-center justify-center p-8 bg-background/20 backdrop-blur-sm animate-in fade-in">
                                <div className="max-w-4xl w-full h-full bg-background/60 backdrop-blur-3xl pointer-events-auto shadow-2xl rounded-3xl border overflow-hidden flex flex-col">
                                    <ScrollArea className="flex-1 p-8">
                                        <div className="space-y-8 max-w-2xl mx-auto">
                                            {messages.length === 0 ? (
                                                <div className="text-center py-20 opacity-50">
                                                    <Box className="w-12 h-12 mx-auto mb-4" />
                                                    <h2 className="text-2xl font-black">Agent Ready</h2>
                                                </div>
                                            ) : (
                                                messages.map((m, i) => (
                                                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                         <div className={`rounded-2xl p-6 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border'} max-w-[85%] shadow-sm`}>
                                                            <div className="text-[9px] uppercase font-black mb-2 opacity-50">{m.role}</div>
                                                            <div className="prose dark:prose-invert prose-sm max-w-none text-foreground">
                                                                {m.content}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-8 bg-background/40 border-t">
                                        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); setInput(""); }} className="relative max-w-2xl mx-auto">
                                            <Input
                                                value={input}
                                                onChange={e => setInput(e.target.value)}
                                                placeholder="Message agent..."
                                                className="bg-background/50 h-16 pl-6 pr-24 rounded-2xl text-lg"
                                            />
                                            <Button type="submit" className="absolute right-2 top-2 bottom-2 px-6 rounded-xl">Send</Button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Node Property Overlay */}
                        {selectedNode && viewMode === "blueprint" && (
                            <div className="absolute top-10 left-10 w-96 bg-background/60 backdrop-blur-3xl border rounded-2xl shadow-2xl animate-in slide-in-from-left duration-300 pointer-events-auto">
                                <NodePropertyPanel
                                    nodeData={selectedNode}
                                    onClose={() => setSelectedNode(null)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. RIGHT SIDEBAR */}
                {viewMode === "blueprint" && (
                    <div className="shrink-0 transition-all duration-300 pointer-events-auto relative z-20">
                        <WorkbenchSidebar 
                            sessionId={sessionId}
                            messages={messages}
                            realtimeEvents={realtimeEvents}
                            backpackState={backpackState}
                            loading={loading}
                            loadingState={loadingState}
                            onSendMessage={sendMessage}
                            onRefreshState={fetchBackpackState}
                            width={sidebarWidth}
                            onWidthChange={setSidebarWidth}
                            isCollapsed={isSidebarCollapsed}
                            onToggleCollapse={toggleSidebar}
                        />
                    </div>
                )}
            </>
        )}
            </div>
        </div>
    );
}
