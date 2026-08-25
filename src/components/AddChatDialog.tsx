import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { addGroupMember } from "@/lib/profiles";
import { createGroupChat, createOrGetDirectChat, searchPublicProfiles } from "@/lib/chat";
import type { PublicProfile } from "@/types";

interface AddChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChatMode = "direct" | "group";

function profileLabel(profile: PublicProfile): string {
  return profile.display_name?.trim() || profile.username?.trim() || "Unknown user";
}

export default function AddChatDialog({ open, onOpenChange }: AddChatDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [selected, setSelected] = useState<PublicProfile[]>([]);
  const [mode, setMode] = useState<ChatMode>("direct");
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.map((profile) => profile.id)), [selected]);

  useEffect(() => {
    let cancelled = false;
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    searchPublicProfiles(trimmedQuery)
      .then((nextResults) => {
        if (!cancelled) setResults(nextResults);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (mode === "direct" && selected.length > 1) {
      setSelected(selected.slice(0, 1));
    }
  }, [mode, selected]);

  function toggleProfile(profile: PublicProfile) {
    setSelected((current) => {
      const exists = current.some((item) => item.id === profile.id);
      if (exists) return current.filter((item) => item.id !== profile.id);
      if (mode === "direct") return [profile];
      return [...current, profile];
    });
  }

  function removeProfile(profileId: string) {
    setSelected((current) => current.filter((item) => item.id !== profileId));
  }

  function reset() {
    setQuery("");
    setResults([]);
    setSelected([]);
    setMode("direct");
    setGroupName("");
    setLoading(false);
    setSaving(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!user) {
      setError("You must be signed in.");
      return;
    }

    if (mode === "direct" && selected.length !== 1) {
      setError("Choose one person for a direct chat.");
      return;
    }

    if (mode === "group" && selected.length < 2) {
      setError("Choose at least two people for a group chat.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "direct") {
        await createOrGetDirectChat(selected[0].id);
      } else {
        const group = await createGroupChat({
          name: groupName.trim() || "New group chat",
        });
        await Promise.all(selected.map((profile) => addGroupMember(group.id, profile.id)));
      }

      reset();
      onOpenChange(false);
      navigate("/messages");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create chat.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Chat</DialogTitle>
          <DialogDescription>
            Pick the people to chat with, then create a direct chat or a group chat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Chat type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "direct" ? "default" : "outline"}
                onClick={() => setMode("direct")}
                className="flex-1"
              >
                Direct
              </Button>
              <Button
                type="button"
                variant={mode === "group" ? "default" : "outline"}
                onClick={() => setMode("group")}
                className="flex-1"
              >
                Group
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chat-search">Search people</Label>
            <Input
              id="chat-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or username"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Selected people</Label>
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selected.map((profile) => (
                  <Badge key={profile.id} variant="secondary" className="gap-2">
                    {profileLabel(profile)}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeProfile(profile.id)}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No one selected yet.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Search results</Label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
              {loading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Searching…</p>
              ) : results.length > 0 ? (
                results.map((profile) => {
                  const selectedHere = selectedIds.has(profile.id);
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => toggleProfile(profile)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{profileLabel(profile)}</span>
                        {profile.username && (
                          <span className="block text-xs text-muted-foreground">@{profile.username}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {selectedHere ? "Selected" : "Add"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  Search for at least two characters to find people.
                </p>
              )}
            </div>
          </div>

          {mode === "group" && (
            <div className="space-y-1.5">
              <Label htmlFor="chat-name">Chat name</Label>
              <Input
                id="chat-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Optional group name"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Creating…" : "Add Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
