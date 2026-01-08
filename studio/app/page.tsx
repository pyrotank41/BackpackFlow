'use client';

/**
 * Homepage - Agent Discovery & Selection
 * 
 * Displays all Studio-compatible agents discovered from /tutorials/
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AgentMetadata } from '@/lib/agent-discovery';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeSwitcher } from '@/components/theme-switcher';

export default function HomePage() {
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch('/api/agents');
        const data = await response.json();
        
        if (data.success) {
          setAgents(data.agents);
        } else {
          setError(data.error || 'Failed to load agents');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-foreground text-xl">Discovering agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-destructive text-xl">❌ {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Unified Top Menu Bar */}
      <header className="bg-background/80 backdrop-blur-2xl border-b h-14 flex items-center px-4 shrink-0">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            🎒 Backpack Studio
          </h1>
            <Badge variant="secondary" className="text-[8px] font-mono">
              v2.0
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              AI Agent Workshop
            </p>
            <div className="w-px h-5 bg-border" />
            <Link href="/credentials">
              <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                Keys
              </span>
            </Link>
            <div className="w-px h-5 bg-border" />
            <ThemeSwitcher />
          </div>
        </div>
        </header>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">

        {/* Stats */}
        <div className="mb-8 flex items-center gap-4">
          <Card className="px-4 py-2">
            <span className="text-muted-foreground">Discovered Agents:</span>{' '}
            <span className="text-foreground font-bold">{agents.length}</span>
          </Card>
        </div>

        {/* Agent Grid */}
        {agents.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-2xl text-foreground mb-2">No agents found</h2>
            <p className="text-muted-foreground mb-6">
              Create an agent in <code className="bg-muted px-2 py-1 rounded">/tutorials/</code>
            </p>
            <p className="text-muted-foreground text-sm">
              See <code>docs/STUDIO-AGENT-GUIDE.md</code> for instructions
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* Footer */}
          <footer className="mt-16 text-center text-muted-foreground text-sm">
          <p>BackpackFlow v2.0 • Backpack Studio v0.1.0</p>
        </footer>
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentMetadata }) {
  return (
    <Link href={`/chat/${agent.id}`}>
      <Card className="p-6 hover:border-primary transition-colors cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {agent.name}
          </h2>
          <span className="text-2xl">💬</span>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {agent.tags.slice(0, 3).map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs"
              >
                {tag}
              </Badge>
            ))}
            {agent.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{agent.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {agent.version && (
            <span>v{agent.version}</span>
          )}
          {agent._type && (
            <span className="capitalize">{agent._type}</span>
          )}
          {agent.outputs.chat.format && (
            <span>{agent.outputs.chat.format}</span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-4 text-primary text-sm font-medium group-hover:text-primary/80">
          Open Chat →
        </div>
      </Card>
    </Link>
  );
}
