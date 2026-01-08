"use client";

import React from "react";
import { X, Info, Settings, Tag } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";

interface NodePropertyPanelProps {
    nodeData: any;
    onClose: () => void;
}

export default function NodePropertyPanel({
    nodeData,
    onClose,
}: NodePropertyPanelProps) {
    if (!nodeData) return null;

    const { metadata, nodeType, nodeParams, label } = nodeData;

    return (
        <div className="h-full flex flex-col bg-background/20 backdrop-blur-3xl border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-bold text-sm">Node Properties</h3>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Node Info */}
                    {metadata && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="text-3xl">{metadata.icon}</div>
                                <div className="flex-1">
                                    <h2 className="font-bold text-lg">
                                        {metadata.displayName}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {metadata.description}
                                    </p>
                                </div>
                            </div>

                            {/* Tags */}
                            {metadata.tags && metadata.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {metadata.tags.map((tag: string) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="text-xs"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* Category & Version */}
                            <div className="flex gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">
                                    {metadata.category}
                                </Badge>
                                <Badge variant="outline">v{metadata.version}</Badge>
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-border" />

                    {/* Configuration */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm">
                                Configuration
                            </h3>
                        </div>

                        {/* Properties */}
                        {metadata?.properties && metadata.properties.length > 0 ? (
                            <div className="space-y-3">
                                {metadata.properties.map((prop: any) => {
                                    const currentValue =
                                        nodeParams?.[prop.name];

                                    return (
                                        <div
                                            key={prop.name}
                                            className="space-y-1"
                                        >
                                            <div className="flex items-center justify-between">
                                                <label className="text-sm font-medium">
                                                    {prop.displayName}
                                                    {prop.required && (
                                                        <span className="text-destructive ml-1">
                                                            *
                                                        </span>
                                                    )}
                                                </label>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {prop.type}
                                                </Badge>
                                            </div>

                                            {prop.description && (
                                                <p className="text-xs text-muted-foreground">
                                                    {prop.description}
                                                </p>
                                            )}

                                            {/* Current Value */}
                                            <div className="mt-1">
                                                <div className="text-xs font-mono bg-muted p-2 rounded border border-border">
                                                    {currentValue !== undefined ? (
                                                        typeof currentValue ===
                                                        "object" ? (
                                                            <pre className="overflow-x-auto">
                                                                {JSON.stringify(
                                                                    currentValue,
                                                                    null,
                                                                    2
                                                                )}
                                                            </pre>
                                                        ) : String(currentValue).startsWith('@cred:') ? (
                                                            <span className="text-purple-500">
                                                                🔐 {currentValue}
                                                            </span>
                                                        ) : String(currentValue).match(/^\$\{.+\}$/) ? (
                                                            <span className="text-blue-500">
                                                                🔧 {currentValue}
                                                            </span>
                                                        ) : (
                                                            String(currentValue)
                                                        )
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            {prop.default !== undefined
                                                                ? `Default: ${prop.default}`
                                                                : "Not set"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                No configurable properties
                            </p>
                        )}
                    </div>

                    {/* Divider */}
                    {metadata?.inputs || metadata?.outputs ? (
                        <div className="border-t border-border" />
                    ) : null}

                    {/* Inputs/Outputs Schema */}
                    {metadata?.inputs && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Expected Inputs
                            </h3>
                            <div className="text-xs space-y-1">
                                {Object.entries(metadata.inputs).map(
                                    ([key, value]: [string, any]) => (
                                        <div
                                            key={key}
                                            className="flex justify-between items-center p-2 bg-muted rounded"
                                        >
                                            <span className="font-mono">
                                                {key}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {value._def?.typeName?.replace(
                                                    "Zod",
                                                    ""
                                                ) || "any"}
                                            </Badge>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {metadata?.outputs && (
                        <div className="space-y-2">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Outputs
                            </h3>
                            <div className="text-xs space-y-1">
                                {Object.entries(metadata.outputs).map(
                                    ([key, value]: [string, any]) => (
                                        <div
                                            key={key}
                                            className="flex justify-between items-center p-2 bg-muted rounded"
                                        >
                                            <span className="font-mono">
                                                {key}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {value._def?.typeName?.replace(
                                                    "Zod",
                                                    ""
                                                ) || "any"}
                                            </Badge>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* Author & Documentation */}
                    {(metadata?.author || metadata?.documentationUrl) && (
                        <>
                            <div className="border-t border-border" />
                            <div className="space-y-2 text-xs">
                                {metadata.author && (
                                    <div>
                                        <span className="text-muted-foreground">
                                            Author:
                                        </span>{" "}
                                        <span className="font-medium">
                                            {metadata.author}
                                        </span>
                                    </div>
                                )}
                                {metadata.documentationUrl && (
                                    <div>
                                        <a
                                            href={metadata.documentationUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            View Documentation →
                                        </a>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
