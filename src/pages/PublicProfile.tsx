import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, UserRound } from "lucide-react";
import { AppHeading } from "@/components/design";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context";
import { createOrGetDirectChat, getPublicProfile } from "@/lib/chat";
import type { PublicProfile } from "@/types";

function profileLabel(profile: PublicProfile): string {
  return profile.display_name?.trim() || profile.username?.trim() || "Unknown user";
}

function ProfileAvatar({ profile }: { profile: PublicProfile }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = profile.avatar_url?.trim() || "";

  useEffect(() => setImageFailed(false), [avatarUrl]);

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-medium text-muted-foreground">
      {avatarUrl && !imageFailed ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        <UserRound className="h-9 w-9" />
      )}
    </div>
  );
}

export default function PublicProfilePage() {
  const { profileId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPublicProfile(profileId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  async function startChat() {
    if (!profile || !user || profile.id === user.id) return;

    setStartingChat(true);
    setError(null);
    try {
      const chat = await createOrGetDirectChat(profile.id);
      navigate("/messages", { state: { preferredGroupId: chat.id } });
    } catch {
      setError("Could not start a chat with this person.");
    } finally {
      setStartingChat(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading profile...</p>;

  if (!profile) {
    return (
      <div className="space-y-3">
        <AppHeading level={2} as="h1">Profile not found</AppHeading>
        <p className="text-sm text-muted-foreground">This profile is unavailable.</p>
        <Button asChild variant="outline">
          <Link to="/messages">Back to messages</Link>
        </Button>
      </div>
    );
  }

  const isOwnProfile = profile.id === user?.id;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Button asChild type="button" variant="ghost" className="-ml-3 w-fit">
        <Link to="/messages">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Messages
        </Link>
      </Button>

      <div className="flex items-center gap-4">
        <ProfileAvatar profile={profile} />
        <div className="min-w-0">
          <AppHeading level={2} as="h1" className="truncate">{profileLabel(profile)}</AppHeading>
          {profile.username && <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>}
        </div>
      </div>

      {profile.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!isOwnProfile && (
        <Button type="button" onClick={() => void startChat()} disabled={startingChat}>
          <MessageCircle className="mr-2 h-4 w-4" />
          {startingChat ? "Opening..." : "Start chat"}
        </Button>
      )}
    </div>
  );
}
