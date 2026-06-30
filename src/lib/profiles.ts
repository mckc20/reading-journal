import { supabase } from "./supabase";
import { deletePublicImageVariants, uploadPublicImage } from "./storage";
import type {
  Group,
  GroupMembership,
  GroupMembershipRole,
  Profile,
} from "@/types";

type NullableProfileRow = Omit<
  Profile,
  | "display_name"
  | "username"
  | "first_name"
  | "last_name"
  | "avatar_url"
  | "bio"
  | "timezone"
  | "language"
> & {
  display_name: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  timezone: string | null;
  language: string | null;
};

type NullableGroupRow = Omit<Group, "description" | "avatar_url"> & {
  description: string | null;
  avatar_url: string | null;
  kind?: Group["kind"] | null;
  direct_pair_key?: string | null;
};

export type ProfilePayload = Partial<
  Pick<
    Profile,
    | "display_name"
    | "username"
    | "first_name"
    | "last_name"
    | "avatar_url"
    | "bio"
    | "timezone"
    | "language"
  >
>;

export type ProfileSaveInput = ProfilePayload & {
  avatar_file?: File | null;
  remove_avatar?: boolean;
};

export type GroupPayload = Pick<Group, "name"> &
  Partial<Pick<Group, "description" | "avatar_url">>;

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
}

function normalizeProfile(row: NullableProfileRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name ?? undefined,
    username: row.username ?? undefined,
    first_name: row.first_name ?? undefined,
    last_name: row.last_name ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    timezone: row.timezone ?? undefined,
    language: row.language ?? undefined,
    created_at: row.created_at,
  };
}

function normalizeProfileInput(input: ProfileSaveInput): ProfileSaveInput {
  return {
    display_name: input.display_name?.trim() || undefined,
    username: input.username?.trim() || undefined,
    first_name: input.first_name?.trim() || undefined,
    last_name: input.last_name?.trim() || undefined,
    avatar_url: input.avatar_url?.trim() || undefined,
    bio: input.bio?.trim() || undefined,
    timezone: input.timezone?.trim() || undefined,
    language: input.language?.trim() || undefined,
    avatar_file: input.avatar_file ?? null,
    remove_avatar: input.remove_avatar ?? false,
  };
}

function withoutAvatarUploadFields(input: ProfileSaveInput) {
  const { avatar_url: _avatarUrl, avatar_file: _avatarFile, remove_avatar: _removeAvatar, ...rest } = input;
  return rest;
}

async function saveProfileAvatar(userId: string, file: File): Promise<{ publicUrl: string; extension: string }> {
  const { publicUrl, extension } = await uploadPublicImage("profile-avatars", userId, userId, file);
  return { publicUrl, extension };
}

async function deleteProfileAvatarVariants(userId: string, keepExtension?: string | null): Promise<void> {
  await deletePublicImageVariants("profile-avatars", userId, userId, keepExtension);
}

function normalizeGroup(row: NullableGroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    created_by: row.created_by,
    kind: row.kind ?? "group",
    direct_pair_key: row.direct_pair_key ?? null,
    created_at: row.created_at,
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be signed in.");
  return user.id;
}

export async function getMyProfile(): Promise<Profile | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeProfile(data as NullableProfileRow) : null;
}

export async function createMyProfile(profile: ProfileSaveInput): Promise<Profile> {
  const userId = await getCurrentUserId();
  const normalized = normalizeProfileInput(profile);
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      ...withoutAvatarUploadFields(normalized),
      avatar_url:
        normalized.remove_avatar || normalized.avatar_file ? undefined : normalized.avatar_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  const created = normalizeProfile(data as NullableProfileRow);
  if (!normalized.avatar_file) return created;

  try {
    const { publicUrl, extension } = await saveProfileAvatar(userId, normalized.avatar_file);
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId)
      .select()
      .single();
    if (updateError) throw updateError;
    await deleteProfileAvatarVariants(userId, extension).catch(() => {});
    return normalizeProfile(updated as NullableProfileRow);
  } catch (avatarError) {
    console.warn("Profile avatar upload failed after creating profile:", avatarError);
    return created;
  }
}

export async function updateMyProfile(profile: ProfileSaveInput): Promise<Profile> {
  const userId = await getCurrentUserId();
  const normalized = normalizeProfileInput(profile);
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...withoutAvatarUploadFields(normalized),
      ...(normalized.remove_avatar
        ? { avatar_url: null }
        : normalized.avatar_file
          ? {}
          : normalized.avatar_url !== undefined
            ? { avatar_url: normalized.avatar_url }
            : {}),
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  const updated = normalizeProfile(data as NullableProfileRow);

  if (normalized.remove_avatar) {
    await deleteProfileAvatarVariants(userId).catch(() => {});
    return updated;
  }

  if (!normalized.avatar_file) return updated;

  try {
    const { publicUrl, extension } = await saveProfileAvatar(userId, normalized.avatar_file);
    const { data: savedAvatar, error: avatarUpdateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId)
      .select()
      .single();
    if (avatarUpdateError) throw avatarUpdateError;
    await deleteProfileAvatarVariants(userId, extension).catch(() => {});
    return normalizeProfile(savedAvatar as NullableProfileRow);
  } catch (avatarError) {
    console.warn("Profile avatar upload failed while updating profile:", avatarError);
    return updated;
  }
}

export async function getMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as NullableGroupRow[]).map(normalizeGroup);
}

export async function createGroup(payload: GroupPayload): Promise<{
  group: Group;
  ownerMembership: GroupMembership;
}> {
  const { data: groupData, error: groupError } = await supabase
    .rpc("create_group_with_owner", {
      group_name: payload.name,
      group_description: payload.description ?? null,
      group_avatar_url: payload.avatar_url ?? null,
    })
    .single();

  if (groupError) throw groupError;

  const group = normalizeGroup(groupData as NullableGroupRow);
  const { data: membershipData, error: membershipError } = await supabase
    .from("group_memberships")
    .select("*")
    .eq("group_id", group.id)
    .eq("user_id", group.created_by)
    .single();

  if (membershipError) throw membershipError;

  return {
    group,
    ownerMembership: membershipData as GroupMembership,
  };
}

export async function getGroupMembers(groupId: string): Promise<GroupMembership[]> {
  const { data, error } = await supabase
    .from("group_memberships")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GroupMembership[];
}

export async function addGroupMember(
  groupId: string,
  userId: string,
): Promise<GroupMembership> {
  const { data, error } = await supabase
    .from("group_memberships")
    .insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;
  return data as GroupMembership;
}

export async function updateGroupMemberRole(
  groupId: string,
  userId: string,
  role: GroupMembershipRole,
): Promise<GroupMembership> {
  const { data, error } = await supabase
    .from("group_memberships")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as GroupMembership;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("group_memberships")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) throw error;
}
