
"use client";

import { useState } from "react";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ChevronLeft, Plus } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { CredentialList } from "@/components/credentials/CredentialList";
import { CredentialDialog } from "@/components/credentials/CredentialDialog";

export default function CredentialsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [editingCredential, setEditingCredential] = useState<any>(null);

  const handleEdit = (cred: any) => {
    setEditingCredential(cred);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCredential(null);
    setIsDialogOpen(true);
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setEditingCredential(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-2xl border-b h-14 flex items-center px-4 shrink-0">
        <div className="flex items-center justify-between w-full max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 group px-2"
                >
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                        Exit
                    </span>
                </Button>
            </Link>
            <div className="w-px h-5 bg-border" />
            <h1 className="text-sm font-bold text-foreground">
              Credential Manager
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <Button 
                size="sm" 
                onClick={handleCreate}
                className="h-8 text-xs font-bold"
             >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Credential
             </Button>
            <div className="w-px h-5 bg-border" />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-muted/10 border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-2">Manage API Keys & Secrets</h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    Securely store credentials for your agents. Credentials are encrypted at rest and can be referenced in your flows using the <code>@cred:name</code> syntax.
                </p>
            </div>

            <CredentialList 
                onEdit={handleEdit} 
                refreshTrigger={refreshTrigger} 
            />
        </div>
      </main>

      <CredentialDialog 
        open={isDialogOpen} 
        onOpenChange={handleOpenChange} 
        onSuccess={handleSuccess}
        editingCredential={editingCredential}
      />
    </div>
  );
}
