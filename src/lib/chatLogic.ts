import { attachmentTitle } from "@/lib/chatAttachments";
import type {
  ChatAttachmentPayload,
  ChatReplySnapshot,
  GroupMembership,
  GroupMessage,
} from "@/types";

export type ChatThreadSortItem = {
  group: {
    created_at: string;
  };
  latestMessage?: Pick<GroupMessage, "created_at">;
};

export function normalizeMessageContent(content: string): string {
  const normalized = content.trim();
  if (!normalized) throw new Error("Message cannot be blank.");
  return normalized;
}

export function normalizeChatMessageContent({
  content,
  attachment,
}: {
  content: string;
  attachment?: ChatAttachmentPayload | null;
}): string {
  const normalized = content.trim();
  if (!normalized && !attachment) throw new Error("Message cannot be blank.");
  return normalized;
}

export function getMessagePreview(message?: Pick<GroupMessage, "content" | "deleted_at">): string {
  if (!message) return "No messages yet.";
  if (message.deleted_at) return "Message deleted";
  return message.content;
}

export function buildReplySnapshot({
  message,
  senderName,
}: {
  message: GroupMessage;
  senderName: string;
}): ChatReplySnapshot {
  const attachment = message.attachment_payload ?? null;
  return {
    message_id: message.id,
    sender_id: message.sender_id,
    sender_name: senderName,
    text: message.content.trim() || (attachment ? attachmentTitle(attachment) : "Message"),
    attachment_type: attachment?.type ?? null,
    attachment_title: attachment ? attachmentTitle(attachment) : null,
    created_at: message.created_at,
  };
}

export function countUnreadMessages({
  messages,
  membership,
  currentUserId,
}: {
  messages: Array<Pick<GroupMessage, "sender_id" | "created_at">>;
  membership: Pick<GroupMembership, "last_read_at">;
  currentUserId: string;
}): number {
  if (!membership.last_read_at) {
    return messages.filter((message) => message.sender_id !== currentUserId).length;
  }

  const lastReadAt = new Date(membership.last_read_at).getTime();
  return messages.filter((message) => {
    if (message.sender_id === currentUserId) return false;
    return new Date(message.created_at).getTime() > lastReadAt;
  }).length;
}

export function sortChatThreads<T extends ChatThreadSortItem>(threads: T[]): T[] {
  return [...threads].sort((first, second) => {
    const firstTime = first.latestMessage?.created_at ?? first.group.created_at;
    const secondTime = second.latestMessage?.created_at ?? second.group.created_at;
    return new Date(secondTime).getTime() - new Date(firstTime).getTime();
  });
}
