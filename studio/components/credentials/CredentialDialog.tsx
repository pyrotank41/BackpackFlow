
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RefreshCcw } from "lucide-react";

interface CredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingCredential?: any; // If null, we are creating
}

const CREDENTIAL_TYPES = [
    { id: 'apiKey', name: 'Generic API Key', fields: ['apiKey'] },
    { id: 'youtubeApi', name: 'YouTube Data API', fields: ['apiKey'] },
    { id: 'openaiApi', name: 'OpenAI API', fields: ['apiKey', 'organizationId'] },
    { id: 'anthropicApi', name: 'Anthropic API', fields: ['apiKey'] },
    { id: 'googleSearchApi', name: 'Google Custom Search', fields: ['apiKey', 'searchEngineId'] },
];

export function CredentialDialog({ 
    open, 
    onOpenChange, 
    onSuccess,
    editingCredential 
}: CredentialDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState(CREDENTIAL_TYPES[0].id);
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingCredential) {
        setName(editingCredential.name);
        setType(editingCredential.type);
        // We can't actually edit data for now without re-entering it due to security masking
        // But for update name, it's fine.
        setData({}); 
    } else {
        setName("");
        setType(CREDENTIAL_TYPES[0].id);
        setData({});
    }
    setError(null);
  }, [editingCredential, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        const url = editingCredential 
            ? `/api/credentials/${editingCredential.id}`
            : "/api/credentials";
        
        const method = editingCredential ? "PATCH" : "POST";
        
        // Filter out empty data fields for patch if not provided (to avoid overwriting with empty)
        const payload: any = { name };
        if (!editingCredential) {
            payload.type = type;
            payload.data = data;
        } else {
            if (Object.keys(data).length > 0) {
                payload.data = data;
            }
        }

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to save");
        }

        onSuccess();
        onOpenChange(false);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const selectedTypeConfig = CREDENTIAL_TYPES.find(t => t.id === type) || CREDENTIAL_TYPES[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingCredential ? "Edit Credential" : "Add New Credential"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="name">Friendly Name</Label>
                <Input 
                    id="name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Production YouTube Key"
                    required
                />
            </div>

            {!editingCredential && (
                <div className="space-y-2">
                    <Label>Credential Type</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CREDENTIAL_TYPES.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs uppercase text-muted-foreground font-bold tracking-wider">
                    Secrets
                </Label>
                {selectedTypeConfig.fields.map(field => (
                    <div key={field} className="space-y-1">
                        <Label htmlFor={field} className="text-sm font-normal font-mono">
                            {field}
                        </Label>
                        <Input 
                            id={field}
                            type="password"
                            value={data[field] || ""}
                            onChange={e => setData(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder={editingCredential ? "(Leave blank to keep unchanged)" : "Enter value..."}
                            required={!editingCredential}
                            className="font-mono text-sm"
                        />
                    </div>
                ))}
            </div>

            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading && <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />}
                    Save Credential
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
