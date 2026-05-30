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
import { useTheme } from "@/context/ThemeContext";
import {
  buildSectionUpdate,
  getMySettings,
  upsertMySettings,
} from "@/lib/userSettings";
import { getErrorMessage } from "@/lib/profiles";
import type {
  UserSettings,
  UserSettingsSections,
  UserSettingsUpdate,
} from "@/types";

interface UserSettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refreshSettings: () => Promise<UserSettings | null>;
  saveSettings: (update: UserSettingsUpdate) => Promise<UserSettings>;
  saveSettingsSection: <Key extends keyof UserSettingsSections>(
    section: Key,
    values: Partial<UserSettingsSections[Key]>,
  ) => Promise<UserSettings>;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const nextSettings = await getMySettings();
      setSettings(nextSettings);
      return nextSettings;
    } catch (settingsError) {
      setError(getErrorMessage(settingsError, "Could not load settings."));
      throw settingsError;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!settings) return;
    setTheme(settings.appearance.theme);
  }, [setTheme, settings?.appearance.theme]);

  const saveSettings = useCallback(
    async (update: UserSettingsUpdate) => {
      if (!user) throw new Error("You must be signed in.");

      setSaving(true);
      setError(null);
      try {
        const savedSettings = await upsertMySettings(update);
        setSettings(savedSettings);
        setTheme(savedSettings.appearance.theme);
        return savedSettings;
      } catch (settingsError) {
        setError(getErrorMessage(settingsError, "Could not save settings."));
        throw settingsError;
      } finally {
        setSaving(false);
      }
    },
    [setTheme, user],
  );

  const saveSettingsSection = useCallback(
    <Key extends keyof UserSettingsSections>(
      section: Key,
      values: Partial<UserSettingsSections[Key]>,
    ) => saveSettings(buildSectionUpdate(section, values)),
    [saveSettings],
  );

  const value = useMemo<UserSettingsContextValue>(
    () => ({
      settings,
      loading,
      saving,
      error,
      refreshSettings,
      saveSettings,
      saveSettingsSection,
    }),
    [
      settings,
      loading,
      saving,
      error,
      refreshSettings,
      saveSettings,
      saveSettingsSection,
    ],
  );

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error("useUserSettings must be used within <UserSettingsProvider>");
  }
  return context;
}
