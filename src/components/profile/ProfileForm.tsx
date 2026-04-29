import type { FormEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileForm as ProfileFormValues } from "@/lib/profileForm";

interface ProfileFormProps {
  form: ProfileFormValues;
  disabled?: boolean;
  saving?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (form: ProfileFormValues) => void;
}

export function ProfileForm({
  form,
  disabled = false,
  saving = false,
  onSubmit,
  onChange,
}: ProfileFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first-name">First name</Label>
          <Input
            id="first-name"
            value={form.first_name}
            onChange={(event) => onChange({ ...form, first_name: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last-name">Last name</Label>
          <Input
            id="last-name"
            value={form.last_name}
            onChange={(event) => onChange({ ...form, last_name: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avatar-url">Avatar URL</Label>
        <Input
          id="avatar-url"
          value={form.avatar_url}
          onChange={(event) => onChange({ ...form, avatar_url: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(event) => onChange({ ...form, bio: event.target.value })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            placeholder="Europe/Vienna"
            value={form.timezone}
            onChange={(event) => onChange({ ...form, timezone: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Input
            id="language"
            placeholder="English"
            value={form.language}
            onChange={(event) => onChange({ ...form, language: event.target.value })}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving || disabled}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
