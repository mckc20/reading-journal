import type { Profile } from "@/types";
import type { ProfilePayload } from "@/lib/profiles";

export type ProfileForm = Required<ProfilePayload>;

export const emptyProfileForm: ProfileForm = {
  first_name: "",
  last_name: "",
  avatar_url: "",
  bio: "",
  timezone: "",
  language: "",
};

export function profileToForm(profile: Profile | null): ProfileForm {
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
    timezone: profile?.timezone ?? "",
    language: profile?.language ?? "",
  };
}

export function cleanProfilePayload(form: ProfileForm): ProfilePayload {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim() || undefined]),
  ) as ProfilePayload;
}
