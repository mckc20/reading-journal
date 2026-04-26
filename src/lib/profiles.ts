import { supabase } from "./supabase";
import type {
  Group,
  GroupMembership,
  GroupMembershipRole,
  Profile,
} from "@/types";

type NullableProfileRow = Omit<Profile, "first_name" | "last_name" | "avatar_url" | "bio" | "timezone" | "language"> & {
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
};

export type ProfilePayload = Partial<
  Pick<Profile, "first_name" | "last_name" | "avatar_url" | "bio" | "timezone" | "language">
>;

export type GroupPayload = Pick<Group, "name"> &
  Partial<Pick<Group, "description" | "avatar_url">>;

function normalizeProfile(row: NullableProfileRow): Profile {
  return {
    id: row.id,
    first_name: row.first_name ?? undefined,
    last_name: row.last_name ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    timezone: row.timezone ?? undefined,
    language: row.language ?? undefined,
    created_at: row.created_at,
  };
}

function normalizeGroup(row: NullableGroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    created_by: row.created_by,
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

async function ensureMyProfile(): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" });

  if (error) throw error;
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

export async function createMyProfile(profile: ProfilePayload): Promise<Profile> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: userId, ...profile })
    .select()
    .single();

  if (error) throw error;
  return normalizeProfile(data as NullableProfileRow);
}

export async function updateMyProfile(profile: ProfilePayload): Promise<Profile> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .update(profile)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return normalizeProfile(data as NullableProfileRow);
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
  await ensureMyProfile();
  const userId = await getCurrentUserId();

  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .insert({ ...payload, created_by: userId })
    .select()
    .single();

  if (groupError) throw groupError;
  const group = normalizeGroup(groupData as NullableGroupRow);

  const { data: membershipData, error: membershipError } = await supabase
    .from("group_memberships")
    .insert({
      group_id: group.id,
      user_id: userId,
      role: "owner",
      status: "active",
    })
    .select()
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
