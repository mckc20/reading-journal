import { supabase } from "@/lib/supabase";
import {
  buildReplySnapshot,
  countUnreadMessages,
  getMessagePreview,
  normalizeChatMessageContent,
  normalizeMessageContent,
  sortChatThreads,
} from "@/lib/chatLogic";
import {
  addGroupMember,
  createGroup,
  getErrorMessage,
  getGroupMembers,
  removeGroupMember,
  updateGroupMemberRole,
  type GroupPayload,
} from "@/lib/profiles";
import type {
  Group,
  GroupMembership,
  GroupMembershipRole,
  GroupMessage,
  PublicProfile,
  ChatAttachmentPayload,
  ChatAttachmentType,
  ChatReplySnapshot,
} from "@/types";

type NullableGroupRow = Omit<Group, "description" | "avatar_url" | "direct_pair_key"> & {
  description: string | null;
  avatar_url: string | null;
  direct_pair_key: string | null;
};

type NullablePublicProfileRow = Omit<PublicProfile, "username" | "display_name" | "avatar_url" | "bio"> & {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type NullableMessageRow = Omit<GroupMessage, "edited_at" | "deleted_at"> & {
  edited_at: string | null;
  deleted_at: string | null;
  attachment_type: ChatAttachmentType | null;
  attachment_payload: ChatAttachmentPayload | null;
  reply_to_message_id: string | null;
  reply_snapshot: ChatReplySnapshot | null;
};

export type ChatMember = GroupMembership & {
  profile?: PublicProfile;
};

export type ChatThread = {
  group: Group;
  currentMembership: GroupMembership;
  members: ChatMember[];
  title: string;
  description?: string;
  avatarProfile?: PublicProfile;
  latestMessage?: GroupMessage;
  unreadCount: number;
};

export type ChatAttachmentSaveReceipt = {
  userId: string;
  displayName: string;
};

type ChatAttachmentSaveReceiptRow = {
  user_id: string;
  display_name: string;
};

export {
  buildReplySnapshot,
  countUnreadMessages,
  getMessagePreview,
  normalizeChatMessageContent,
  normalizeMessageContent,
  sortChatThreads,
};

function normalizeGroup(row: NullableGroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    created_by: row.created_by,
    kind: row.kind,
    direct_pair_key: row.direct_pair_key,
    created_at: row.created_at,
  };
}

function normalizePublicProfile(row: NullablePublicProfileRow): PublicProfile {
  return {
    id: row.id,
    username: row.username ?? undefined,
    display_name: row.display_name ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    created_at: row.created_at,
  };
}

function normalizeMessage(row: NullableMessageRow): GroupMessage {
  return {
    id: row.id,
    group_id: row.group_id,
    sender_id: row.sender_id,
    content: row.content,
    attachment_type: row.attachment_type,
    attachment_payload: row.attachment_payload,
    reply_to_message_id: row.reply_to_message_id,
    reply_snapshot: row.reply_snapshot,
    created_at: row.created_at,
    updated_at: row.updated_at,
    edited_at: row.edited_at,
    deleted_at: row.deleted_at,
  };
}

function profileDisplayName(profile?: PublicProfile): string {
  if (!profile) return "Unknown user";
  return profile.display_name?.trim() || profile.username?.trim() || "Unknown user";
}

function buildThreadTitle(
  group: Group,
  members: ChatMember[],
  currentUserId: string,
): { title: string; avatarProfile?: PublicProfile } {
  if (group.kind === "group") return { title: group.name };

  const otherMember = members.find((member) => member.user_id !== currentUserId);
  return {
    title: profileDisplayName(otherMember?.profile),
    avatarProfile: otherMember?.profile,
  };
}

async function getProfilesById(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("get_public_profiles", {
    profile_ids: uniqueIds,
  });

  if (error) throw error;

  return new Map(
    ((data ?? []) as NullablePublicProfileRow[]).map((row) => {
      const profile = normalizePublicProfile(row);
      return [profile.id, profile];
    }),
  );
}


export async function searchPublicProfiles(
  query: string,
): Promise<PublicProfile[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const { data, error } = await supabase.rpc("search_public_profiles", {
    search_query: normalizedQuery,
  });

  if (error) throw error;
  return ((data ?? []) as NullablePublicProfileRow[]).map(normalizePublicProfile);
}

export async function getPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const profiles = await getProfilesById([profileId]);
  return profiles.get(profileId) ?? null;
}

export async function getChatThreads(currentUserId: string): Promise<ChatThread[]> {
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (groupError) throw groupError;

  const groups = ((groupData ?? []) as NullableGroupRow[]).map(normalizeGroup);
  const groupIds = groups.map((group) => group.id);
  if (groupIds.length === 0) return [];

  const [{ data: membershipData, error: membershipError }, { data: messageData, error: messageError }] =
    await Promise.all([
      supabase
        .from("group_memberships")
        .select("*")
        .in("group_id", groupIds)
        .order("joined_at", { ascending: true }),
      supabase
        .from("group_messages")
        .select("*")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  if (membershipError) throw membershipError;
  if (messageError) throw messageError;

  const memberships = (membershipData ?? []) as GroupMembership[];
  const messages = ((messageData ?? []) as NullableMessageRow[]).map(normalizeMessage);
  const profiles = await getProfilesById(memberships.map((member) => member.user_id));

  const threads: ChatThread[] = groups
      .map((group): ChatThread | null => {
        const groupMembers = memberships
          .filter((member) => member.group_id === group.id)
          .map((member) => ({
            ...member,
            profile: profiles.get(member.user_id),
          }));
        const currentMembership = groupMembers.find((member) => member.user_id === currentUserId);
        if (!currentMembership) return null;

        const groupMessages = messages.filter((message) => message.group_id === group.id);
        const latestMessage = groupMessages[0];
        const { title, avatarProfile } = buildThreadTitle(group, groupMembers, currentUserId);

        return {
          group,
          currentMembership,
          members: groupMembers,
          title,
          description: group.kind === "group" ? group.description : undefined,
          avatarProfile,
          latestMessage,
          unreadCount: countUnreadMessages({
            messages: groupMessages,
            membership: currentMembership,
            currentUserId,
          }),
        };
      })
      .filter((thread): thread is ChatThread => thread !== null);

  return sortChatThreads(threads);
}

export async function getChatMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data ?? []) as NullableMessageRow[]).map(normalizeMessage).reverse();
}

export async function getSavedChatAttachmentMessageIds(messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("chat_attachment_saves")
    .select("message_id")
    .in("message_id", messageIds);
  if (error) throw error;

  return new Set((data ?? []).map((row) => String(row.message_id)));
}

export async function getChatAttachmentSaveReceipts(messageId: string): Promise<ChatAttachmentSaveReceipt[]> {
  const { data, error } = await supabase.rpc("get_chat_attachment_save_receipts", {
    target_message_id: messageId,
  });

  if (error) throw error;
  return ((data ?? []) as ChatAttachmentSaveReceiptRow[]).map((receipt) => ({
    userId: String(receipt.user_id),
    displayName: String(receipt.display_name),
  }));
}

export async function saveChatAttachment(userId: string, messageId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_attachment_saves")
    .upsert({ user_id: userId, message_id: messageId }, { onConflict: "user_id,message_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function copyChatAttachmentImage(
  messageId: string,
  targetType: "book" | "author" | "series",
  targetId: string,
  sourceBookId?: string,
  sourceAuthorName?: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("copy-chat-attachment-image", {
    body: { messageId, targetType, targetId, sourceBookId, sourceAuthorName },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      const errorBody = await response.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof errorBody?.error === "string") throw new Error(errorBody.error);
    }
    throw error;
  }
  if (!data || typeof data.publicUrl !== "string") {
    throw new Error("The image-copy service did not return an image URL.");
  }
  return data.publicUrl;
}

export async function getChatMembers(groupId: string): Promise<ChatMember[]> {
  const members = await getGroupMembers(groupId);
  const profiles = await getProfilesById(members.map((member) => member.user_id));
  return members.map((member) => ({ ...member, profile: profiles.get(member.user_id) }));
}

export async function createGroupChat(payload: GroupPayload): Promise<Group> {
  const { group } = await createGroup(payload);
  return group;
}

export async function createOrGetDirectChat(profileId: string): Promise<Group> {
  const { data, error } = await supabase
    .rpc("create_or_get_direct_group", { other_user_id: profileId })
    .single();

  if (error) throw error;
  return normalizeGroup(data as NullableGroupRow);
}

export async function addGroupMemberByUsername(
  groupId: string,
  username: string,
): Promise<GroupMembership> {
  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) throw new Error("Username is required.");

  const { data, error } = await supabase
    .rpc("get_public_profile_by_username", { username_query: normalizedUsername })
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No user found with that username.");

  return addGroupMember(groupId, (data as NullablePublicProfileRow).id);
}

export async function sendChatMessage(
  groupId: string,
  senderId: string,
  content: string,
  attachment?: ChatAttachmentPayload | null,
  reply?: ChatReplySnapshot | null,
): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: senderId,
      content: normalizeChatMessageContent({ content, attachment }),
      attachment_type: attachment?.type ?? null,
      attachment_payload: attachment ?? null,
      reply_to_message_id: reply?.message_id ?? null,
      reply_snapshot: reply ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return normalizeMessage(data as NullableMessageRow);
}

export async function editChatMessage(messageId: string, content: string): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from("group_messages")
    .update({ content: normalizeMessageContent(content) })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;
  return normalizeMessage(data as NullableMessageRow);
}

export async function deleteChatMessage(messageId: string): Promise<GroupMessage> {
  const { data, error } = await supabase
    .from("group_messages")
    .update({ deleted_at: new Date().toISOString(), content: "" })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;
  return normalizeMessage(data as NullableMessageRow);
}

export async function markChatRead(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_group_read", { group_uuid: groupId });

  if (error) throw error;
}

export async function changeGroupMemberRole(
  groupId: string,
  userId: string,
  role: GroupMembershipRole,
): Promise<GroupMembership> {
  return updateGroupMemberRole(groupId, userId, role);
}

export async function removeChatMember(groupId: string, userId: string): Promise<void> {
  return removeGroupMember(groupId, userId);
}

export function toChatErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error, fallback);

  if (message.includes("group_memberships_user_id_fkey")) {
    return "No app user exists for that profile.";
  }

  if (message.includes("duplicate key")) {
    return "That person is already in this chat.";
  }

  return message;
}
