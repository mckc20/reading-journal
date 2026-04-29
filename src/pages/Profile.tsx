import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, useProfile } from "@/context";

function getDisplayName(
  profile: ReturnType<typeof useProfile>["profile"],
  email?: string | null,
): string {
  const name = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || email || "Profile";
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, loading, error } = useProfile();
  const displayName = getDisplayName(profile, user?.email);
  const details = [
    profile?.bio ? { label: "Bio", value: profile.bio } : null,
    profile?.timezone ? { label: "Timezone", value: profile.timezone } : null,
    profile?.language ? { label: "Language", value: profile.language } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading leading-snug font-medium">Profile</h1>
          {loading && <p className="text-sm text-muted-foreground">Loading profile...</p>}
        </div>
        <Button asChild>
          <Link to="/settings/profile">
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <ProfileAvatar profile={profile} email={user?.email} className="h-16 w-16 text-lg" />
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{displayName}</CardTitle>
              {user?.email && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
            </div>
          </div>
        </CardHeader>

        {details.length > 0 && (
          <CardContent>
            <dl className="space-y-4">
              {details.map((item) => (
                <div key={item.label} className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                  <dd className="text-sm whitespace-pre-wrap">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
