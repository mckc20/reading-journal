import { GroupsManager } from "@/components/groups/GroupsManager";

export default function Groups() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading leading-snug font-medium">Groups</h1>
      </div>

      <GroupsManager />
    </div>
  );
}
