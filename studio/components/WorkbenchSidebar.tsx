"use client";

import React, { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, SendHorizontal, MessageSquare, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface WorkbenchSidebarProps {
    sessionId: string;
    messages: Message[];
    realtimeEvents: BackpackEvent[];
    backpackState: Record<string, any> | null;
    loading: boolean;
    loadingState: boolean;
    onSendMessage: (content: string) => void;
    onRefreshState: () => void;
    width: number;
    onWidthChange: (width: number) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export function WorkbenchSidebar({
    sessionId,
    messages,
    realtimeEvents,
    backpackState,
    loading,
    loadingState,
    onSendMessage,
    onRefreshState,
    width,
    onWidthChange,
    isCollapsed,
    onToggleCollapse,
}: WorkbenchSidebarProps) {
    const [activeTab, setActiveTab] = useState<"chat" | "telemetry" | "state">("chat");
    const [input, setInput] = useState("");
    const [isResizing, setIsResizing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 320 && newWidth <= 800) {
                onWidthChange(newWidth);
            }
        };
        const handleMouseUp = () => setIsResizing(false);
        if (isResizing) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "ew-resize";
        }
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
        };
    }, [isResizing, onWidthChange]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput("");
        }
    };

    return (
        <div
            style={{ width: `${width}px` }}
            className="flex h-full bg-background/20 backdrop-blur-3xl border-l transition-all duration-300 pointer-events-auto relative shadow-2xl overflow-hidden"
        >
            {/* 1. SIDEBAR CONTENT Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* Resize Handle (Inside the left edge of sidebar content) */}
                <div 
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 hover:bg-primary/50 cursor-ew-resize z-50 transition-all group" 
                    onMouseDown={() => setIsResizing(true)} 
                >
                    <div className="absolute inset-y-0 -left-2 w-4 pointer-events-none" />
                </div>

                {/* Content Area Rendering */}
                {activeTab === "chat" && (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="h-14 flex items-center px-6 border-b bg-muted/5 shrink-0">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <MessageSquare className="w-3 h-3 text-primary" /> Agent Chat
                            </h3>
                        </div>
                        <ScrollArea className="flex-1 p-5">
                            <div className="space-y-6">
                                {messages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 py-20">
                                        <MessageSquare className="w-12 h-12 mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Buffer Empty</p>
                                    </div>
                                ) : (
                                    messages.map((m, i) => (
                                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[90%] rounded-2xl p-4 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 border shadow-sm"}`}>
                                                <div className="prose dark:prose-invert prose-xs max-w-none text-foreground">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                        <div className="p-5 border-t bg-background/20 backdrop-blur-md">
                            <form onSubmit={handleSubmit} className="relative group">
                                <Input 
                                    value={input} 
                                    onChange={e => setInput(e.target.value)} 
                                    placeholder="Type a message..." 
                                    disabled={loading}
                                    className="bg-background/40 border-border/50 pr-12 h-12 rounded-xl focus-visible:ring-primary/30 transition-all" 
                                />
                                <Button 
                                    type="submit" 
                                    size="icon" 
                                    disabled={loading || !input.trim()}
                                    className="absolute right-1 top-1 bottom-1 h-10 w-10 rounded-lg group-hover:scale-105 transition-transform"
                                >
                                    {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                                </Button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === "telemetry" && (
                     <div className="flex-1 flex flex-col h-full">
                        <div className="h-14 flex items-center px-6 border-b bg-muted/5 shrink-0 justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Zap className="w-3 h-3 text-primary" /> Live Trace
                            </h3>
                            <Badge variant="outline" className="text-[9px] font-mono">{realtimeEvents.length} Events</Badge>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-5 space-y-4">
                                {realtimeEvents.length === 0 ? (
                                    <div className="text-center py-20 opacity-30 text-[10px] font-black uppercase">No active trace</div>
                                ) : (
                                    realtimeEvents.map((e, i) => (
                                        <div key={i} className="group relative pl-4 border-l border-primary/20 hover:border-primary/50 transition-colors py-2">
                                            <div className="absolute left-[-5px] top-3 w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                            <div className="text-[10px] font-mono">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-primary font-bold uppercase">{e.type}</span>
                                                    <span className="text-muted-foreground/50 text-[9px]">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="text-foreground/80 font-bold">{e.nodeId}</div>
                                                {e.payload && (
                                                    <pre className="mt-2 text-[9px] bg-muted/30 p-2 rounded border border-border/50 overflow-x-auto">
                                                        {JSON.stringify(e.payload, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {activeTab === "state" && (
                    <div className="flex-1 flex flex-col h-full">
                        <div className="p-4 h-14 border-b bg-muted/5 flex items-center justify-between shrink-0 px-6">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                🎒 Backpack State
                            </h3>
                            <Button variant="ghost" size="sm" onClick={onRefreshState} disabled={loadingState} className="h-7 text-[9px] uppercase font-bold">
                                <RefreshCcw className={`w-3 h-3 mr-1.5 ${loadingState ? 'animate-spin' : ''}`} /> Refresh
                            </Button>
                        </div>
                        <ScrollArea className="flex-1 p-5">
                            {backpackState && Object.entries(backpackState).length > 0 ? (
                                Object.entries(backpackState).map(([k, v]) => (
                                    <div key={k} className="mb-6 group">
                                        <div className="text-[10px] font-bold text-primary mb-2 uppercase tracking-tight flex items-center gap-2">
                                            <span className="w-1 h-3 bg-primary/30 rounded-full" /> {k}
                                        </div>
                                        <pre className="text-[10px] font-mono bg-muted/30 p-3 rounded-xl border border-border/50 overflow-auto max-h-60 shadow-inner group-hover:bg-muted/50 transition-colors">
                                            {JSON.stringify(v, null, 2)}
                                        </pre>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 py-20 text-center">
                                    <RefreshCcw className="w-10 h-10 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Backpack is Empty</p>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* 2. ICON RAIL (Right side) */}
            <div className="w-14 border-l border-border/50 flex flex-col items-center py-4 gap-4 bg-muted/5 shrink-0 z-10">
                <button 
                    onClick={() => {
                        if (activeTab === "chat" && !isCollapsed) {
                            onToggleCollapse();
                        } else {
                            setActiveTab("chat");
                            if (isCollapsed) onToggleCollapse();
                        }
                    }}
                    className={`p-2 rounded-lg transition-all ${!isCollapsed && activeTab === 'chat' ? 'bg-primary/20 text-primary scale-110' : 'text-muted-foreground hover:bg-muted'}`}
                >
                    <MessageSquare className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => {
                        if (activeTab === "telemetry" && !isCollapsed) {
                            onToggleCollapse();
                        } else {
                            setActiveTab("telemetry");
                            if (isCollapsed) onToggleCollapse();
                        }
                    }}
                    className={`p-2 rounded-lg transition-all ${!isCollapsed && activeTab === 'telemetry' ? 'bg-primary/20 text-primary scale-110' : 'text-muted-foreground hover:bg-muted'}`}
                >
                    <Zap className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => {
                        if (activeTab === "state" && !isCollapsed) {
                            onToggleCollapse();
                        } else {
                            setActiveTab("state");
                            if (isCollapsed) onToggleCollapse();
                        }
                    }}
                    className={`p-2 rounded-lg transition-all ${!isCollapsed && activeTab === 'state' ? 'bg-primary/20 text-primary scale-110' : 'text-muted-foreground hover:bg-muted'}`}
                >
                    🎒
                </button>

                <div className="mt-auto">
                    <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                        {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
