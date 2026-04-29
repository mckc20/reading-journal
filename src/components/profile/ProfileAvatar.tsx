import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

interface ProfileAvatarProps {
  profile: Profile | null;
  email?: string | null;
  className?: string;
}

function getInitials(profile: Profile | null, email?: string | null): string {
  const firstInitial = profile?.first_name?.trim().charAt(0) ?? "";
  const lastInitial = profile?.last_name?.trim().charAt(0) ?? "";
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();

  if (initials) return initials;
  return email?.trim().charAt(0).toUpperCase() ?? "";
}

export function ProfileAvatar({ profile, email, className }: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = profile?.avatar_url?.trim() || "";
  const initials = useMemo(() => getInitials(profile, email), [profile, email]);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <UserRound className="h-5 w-5" aria-hidden="true" />
      )}
    </span>
  );
}
