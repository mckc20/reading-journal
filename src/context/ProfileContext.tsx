import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  createMyProfile,
  getErrorMessage,
  getMyProfile,
  updateMyProfile,
  type ProfilePayload,
} from "@/lib/profiles";
import type { Profile } from "@/types";

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<Profile | null>;
  saveProfile: (payload: ProfilePayload) => Promise<Profile>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const nextProfile = await getMyProfile();
      setProfile(nextProfile);
      return nextProfile;
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, "Could not load profile."));
      throw refreshError;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const saveProfile = useCallback(
    async (payload: ProfilePayload) => {
      const savedProfile = profile
        ? await updateMyProfile(payload)
        : await createMyProfile(payload);
      setProfile(savedProfile);
      setError(null);
      return savedProfile;
    },
    [profile],
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      error,
      refreshProfile,
      saveProfile,
    }),
    [profile, loading, error, refreshProfile, saveProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within <ProfileProvider>");
  return context;
}
