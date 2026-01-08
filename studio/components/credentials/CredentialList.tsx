
"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Pencil, 
  Trash2, 
  Key, 
  RefreshCcw 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ... existing imports

interface Credential {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface CredentialListProps {
  onEdit: (cred: Credential) => void;
  refreshTrigger: number;
}

export function CredentialList({ onEdit, refreshTrigger }: CredentialListProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [credentialToDelete, setCredentialToDelete] = useState<Credential | null>(null);

  const fetchCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error("Failed to fetch credentials");
      const data = await res.json();
      setCredentials(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, [refreshTrigger]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/credentials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      
      // Optimistic update
      setCredentials(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingId(null);
      setCredentialToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground">
        <RefreshCcw className="animate-spin w-5 h-5 mr-2" />
        Loading credentials...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20">
        Error: {error}
        <Button variant="link" onClick={fetchCredentials}>Retry</Button>
      </div>
    );
  }

  if (credentials.length === 0) {
    return (
      <div className="text-center py-16 border rounded-xl bg-muted/20 border-dashed">
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-5 h-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">No credentials found</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first credential to get started
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {credentials.map((cred) => (
            <TableRow key={cred.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    {cred.name}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="font-mono text-xs">
                    {cred.type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {cred.id.substring(0, 15)}...
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(cred.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => onEdit(cred)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === cred.id}
                      >
                        {deletingId === cred.id ? (
                            <RefreshCcw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Credential?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the credential 
                          <span className="font-medium text-foreground"> {cred.name}</span>.
                          Flows relying on this credential will stop working.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(cred.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
