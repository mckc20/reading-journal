import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context";
import { attachmentTitle } from "@/lib/chatAttachments";
import { getChatThreads, getMessagePreview, sendChatMessage, type ChatThread } from "@/lib/chat";
import { cn } from "@/lib/utils";
import type { ChatAttachmentPayload } from "@/types";

interface SendAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: ChatAttachmentPayload;
  title: string;
  description?: string;
  onSent?: () => void;
}

function threadTypeLabel(thread: ChatThread): string {
  return thread.group.kind === "group" ? "Group chat" : "Direct chat";
}

function threadPreview(thread: ChatThread): string {
  if (thread.latestMessage) return getMessagePreview(thread.latestMessage);
  return "No messages yet";
}

export default function SendAttachmentDialog({
  open,
  onOpenChange,
  attachment,
  title,
  description,
  onSent,
}: SendAttachmentDialogProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.group.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  useEffect(() => {
    const currentUser = user;
    if (!open || !currentUser) return;
    const userId = currentUser.id;

    let cancelled = false;

    async function loadThreads() {
      try {
        setLoading(true);
        setError(null);
        const nextThreads = await getChatThreads(userId);
        if (cancelled) return;
        setThreads(nextThreads);
        setSelectedThreadId((current) => current && nextThreads.some((thread) => thread.group.id === current)
          ? current
          : nextThreads[0]?.group.id ?? "");
      } catch (loadError) {
        if (!cancelled) {
          setThreads([]);
          setSelectedThreadId("");
          setError(loadError instanceof Error ? loadError.message : "Could not load chats.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setMessage("");
    void loadThreads();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  async function handleSend() {
    const currentUser = user;
    if (!currentUser || !selectedThread) return;

    try {
      setSending(true);
      setError(null);
      await sendChatMessage(selectedThread.group.id, currentUser.id, message, attachment, null);
      onOpenChange(false);
      onSent?.();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send attachment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? attachmentTitle(attachment)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add a note to go with this attachment..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">Select chat</label>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading chats..." : `${threads.length} available`}
              </p>
            </div>

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {!loading && threads.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No chats yet. Start one in Groups first.
                </div>
              ) : (
                threads.map((thread) => {
                  const selected = thread.group.id === selectedThreadId;
                  return (
                    <button
                      key={thread.group.id}
                      type="button"
                      onClick={() => setSelectedThreadId(thread.group.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        selected ? "border-primary bg-primary/5" : "hover:bg-muted/45",
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-primary text-primary" : "text-muted-foreground",
                      )}>
                        {thread.group.kind === "group" ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{thread.title}</span>
                          {thread.group.kind === "group" && (
                            <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              Group
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {threadPreview(thread)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{threadTypeLabel(thread)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSend()} disabled={!selectedThread || sending || loading}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending..." : "Send attachment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
