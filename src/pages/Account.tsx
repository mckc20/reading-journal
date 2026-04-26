import { useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw, Save, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context";
import {
  addGroupMember,
  createGroup,
  createMyProfile,
  getGroupMembers,
  getMyGroups,
  getMyProfile,
  removeGroupMember,
  updateGroupMemberRole,
  updateMyProfile,
  type GroupPayload,
  type ProfilePayload,
} from "@/lib/profiles";
import type { Group, GroupMembership, GroupMembershipRole, Profile } from "@/types";

type ProfileForm = Required<ProfilePayload>;

const emptyProfileForm: ProfileForm = {
  first_name: "",
  last_name: "",
  avatar_url: "",
  bio: "",
  timezone: "",
  language: "",
};

function profileToForm(profile: Profile | null): ProfileForm {
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    timezone: profile?.timezone ?? "",
    language: profile?.language ?? "",
  };
}

function cleanProfilePayload(form: ProfileForm): ProfilePayload {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim() || undefined]),
  ) as ProfilePayload;
}

export default function Account() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [members, setMembers] = useState<GroupMembership[]>([]);
  const [groupForm, setGroupForm] = useState<GroupPayload>({ name: "", description: "" });
  const [memberUserId, setMemberUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  async function loadAccount() {
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextGroups] = await Promise.all([getMyProfile(), getMyGroups()]);
      setProfile(nextProfile);
      setProfileForm(profileToForm(nextProfile));
      setGroups(nextGroups);
      setSelectedGroupId((current) =>
        nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load account data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    getGroupMembers(selectedGroupId)
      .then((nextMembers) => {
        if (!cancelled) setMembers(nextMembers);
      })
      .catch((memberError) => {
        if (!cancelled) {
          setError(memberError instanceof Error ? memberError.message : "Could not load group members.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      const payload = cleanProfilePayload(profileForm);
      const savedProfile = profile
        ? await updateMyProfile(payload)
        : await createMyProfile(payload);
      setProfile(savedProfile);
      setProfileForm(profileToForm(savedProfile));
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupForm.name.trim();
    if (!name) return;

    setCreatingGroup(true);
    setError(null);
    setMessage(null);

    try {
      const { group } = await createGroup({
        name,
        description: groupForm.description?.trim() || undefined,
        avatar_url: groupForm.avatar_url?.trim() || undefined,
      });
      setGroups((current) => [group, ...current]);
      setSelectedGroupId(group.id);
      setGroupForm({ name: "", description: "" });
      setMessage("Group created.");
    } catch (groupError) {
      setError(groupError instanceof Error ? groupError.message : "Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUserId = memberUserId.trim();
    if (!selectedGroupId || !nextUserId) return;

    setError(null);
    setMessage(null);

    try {
      const member = await addGroupMember(selectedGroupId, nextUserId);
      setMembers((current) => [...current.filter((item) => item.user_id !== member.user_id), member]);
      setMemberUserId("");
      setMessage("Member added.");
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "Could not add member.");
    }
  }

  async function changeRole(userId: string, role: GroupMembershipRole) {
    if (!selectedGroupId) return;
    setError(null);
    setMessage(null);

    try {
      const member = await updateGroupMemberRole(selectedGroupId, userId, role);
      setMembers((current) =>
        current.map((item) => (item.user_id === userId ? member : item)),
      );
      setMessage("Member role updated.");
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Could not update member role.");
    }
  }

  async function removeMember(userId: string) {
    if (!selectedGroupId) return;
    setError(null);
    setMessage(null);

    try {
      await removeGroupMember(selectedGroupId, userId);
      setMembers((current) => current.filter((member) => member.user_id !== userId));
      setMessage(userId === user?.id ? "You left the group." : "Member removed.");
      if (userId === user?.id) {
        const nextGroups = await getMyGroups();
        setGroups(nextGroups);
        setSelectedGroupId(nextGroups[0]?.id || "");
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove member.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading leading-snug font-medium">Account</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadAccount()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Tabs defaultValue="profile">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1">
            Profile
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex-1">
            Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Personal details for this account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveProfile}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={profileForm.first_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, first_name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={profileForm.last_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, last_name: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar-url">Avatar URL</Label>
                  <Input
                    id="avatar-url"
                    value={profileForm.avatar_url}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileForm.bio}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, bio: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      placeholder="Europe/Vienna"
                      value={profileForm.timezone}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, timezone: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      placeholder="English"
                      value={profileForm.language}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, language: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <Button type="submit" disabled={savingProfile || loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingProfile ? "Saving..." : "Save profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="mt-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Create Group</CardTitle>
                <CardDescription>Private reading groups.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={submitGroup}>
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Name</Label>
                    <Input
                      id="group-name"
                      value={groupForm.name}
                      onChange={(event) =>
                        setGroupForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-description">Description</Label>
                    <Textarea
                      id="group-description"
                      value={groupForm.description ?? ""}
                      onChange={(event) =>
                        setGroupForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>
                  <Button type="submit" disabled={creatingGroup || !groupForm.name.trim()}>
                    <Users className="mr-2 h-4 w-4" />
                    {creatingGroup ? "Creating..." : "Create group"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My Groups</CardTitle>
                <CardDescription>
                  {groups.length === 0
                    ? "No groups yet."
                    : `${groups.length} group${groups.length === 1 ? "" : "s"}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groups.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="selected-group">Group</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger id="selected-group" className="w-full">
                        <SelectValue placeholder="Choose a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedGroup && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="font-heading leading-snug font-medium">{selectedGroup.name}</h2>
                      {selectedGroup.description && (
                        <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
                      )}
                    </div>

                    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitMember}>
                      <Input
                        aria-label="User ID"
                        placeholder="User UUID"
                        value={memberUserId}
                        onChange={(event) => setMemberUserId(event.target.value)}
                      />
                      <Button type="submit" variant="outline" disabled={!memberUserId.trim()}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add
                      </Button>
                    </form>

                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={member.user_id}
                          className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{member.user_id}</p>
                            <p className="text-xs text-muted-foreground">{member.status}</p>
                          </div>
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              changeRole(member.user_id, value as GroupMembershipRole)
                            }
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMember(member.user_id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
