import { useEffect, useMemo, useState, type FormEvent } from "react";
import { UserPlus, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context";
import {
  addGroupMember,
  createGroup,
  getErrorMessage,
  getGroupMembers,
  getMyGroups,
  removeGroupMember,
  updateGroupMemberRole,
  type GroupPayload,
} from "@/lib/profiles";
import type { Group, GroupMembership, GroupMembershipRole } from "@/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAddMemberErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, "Could not add member.");

  if (
    message.includes("group_memberships_user_id_fkey") ||
    message.includes("violates foreign key constraint")
  ) {
    return "No app user exists for that UUID. Make sure the user has accepted their invite.";
  }

  return message;
}

export function GroupsManager() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [members, setMembers] = useState<GroupMembership[]>([]);
  const [groupForm, setGroupForm] = useState<GroupPayload>({ name: "", description: "" });
  const [memberUserId, setMemberUserId] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  async function loadGroups() {
    setError(null);
    try {
      const nextGroups = await getMyGroups();
      setGroups(nextGroups);
      setSelectedGroupId((current) =>
        nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id || "",
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load groups."));
    }
  }

  useEffect(() => {
    void loadGroups();
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
          setError(getErrorMessage(memberError, "Could not load group members."));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

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
      setError(getErrorMessage(groupError, "Could not create group."));
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

    if (!UUID_PATTERN.test(nextUserId)) {
      setError("Enter a valid user UUID.");
      return;
    }

    try {
      const member = await addGroupMember(selectedGroupId, nextUserId);
      setMembers((current) => [
        ...current.filter((item) => item.user_id !== member.user_id),
        member,
      ]);
      setMemberUserId("");
      setMessage("Member added.");
    } catch (memberError) {
      setError(getAddMemberErrorMessage(memberError));
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
      setError(getErrorMessage(roleError, "Could not update member role."));
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
      setError(getErrorMessage(removeError, "Could not remove member."));
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

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
    </div>
  );
}
