import { supabase } from "./supabase";
import type {
  AppearanceSettings,
  BackupSettings,
  CollectionSettings,
  LibrarySettings,
  NotificationSettings,
  PrivacySettings,
  ReadingSettings,
  UserSettings,
  UserSettingsSections,
  UserSettingsUpdate,
} from "@/types";

type SettingsSectionKey = keyof UserSettingsSections;

type UserSettingsRow = {
  user_id: string;
  appearance: unknown;
  reading: unknown;
  library: unknown;
  collections: unknown;
  notifications: unknown;
  privacy: unknown;
  backup: unknown;
  last_seen_release_note_version: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: "system",
  accent_color: "default",
  compact_mode: false,
  reduced_animations: false,
  book_cover_style: "rounded",
  corner_radius: "medium",
  font_size: "medium",
  density: "comfortable",
};

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  default_reading_status: "Wishlist",
  reading_pace_calculation: "recent_logs",
  progress_display: "percentage",
  reading_streak_enabled: true,
  reading_streak_goal_days: 7,
  auto_finish_books: true,
  estimated_completion_dates: true,
};

export const DEFAULT_LIBRARY_SETTINGS: LibrarySettings = {
  default_sorting: "recently_added",
  default_view: "grid",
  default_filters: {},
  show_unfinished_series_first: true,
  hide_completed_books: false,
  show_reading_statistics: true,
};

export const DEFAULT_COLLECTION_SETTINGS: CollectionSettings = {
  collection_visibility: "private",
  automatic_collections: true,
  smart_collections: true,
  collection_behavior: "manual_and_smart",
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  reading_reminders: false,
  weekly_summary: false,
  daily_goal_reminders: false,
  goal_completion_notifications: true,
  friend_activity_notifications: false,
  new_follower_notifications: false,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  private_account: true,
  show_reading_activity: false,
  show_reading_statistics_publicly: false,
  show_reading_goals_publicly: false,
  allow_followers: false,
  blocked_users: [],
};

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  automatic_backups: false,
  backup_frequency: "manual",
  last_backup_at: null,
};

export const DEFAULT_SETTINGS_SECTIONS: UserSettingsSections = {
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  reading: DEFAULT_READING_SETTINGS,
  library: DEFAULT_LIBRARY_SETTINGS,
  collections: DEFAULT_COLLECTION_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  privacy: DEFAULT_PRIVACY_SETTINGS,
  backup: DEFAULT_BACKUP_SETTINGS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeSection<TSection extends object>(
  defaults: TSection,
  stored: unknown,
  update?: Partial<TSection>,
): TSection {
  const storedValues = isRecord(stored) ? stored : {};
  return {
    ...defaults,
    ...storedValues,
    ...update,
  } as TSection;
}

function normalizeLibrarySettings(settings: LibrarySettings): LibrarySettings {
  const storedDefaultView = String(settings.default_view);

  if (storedDefaultView === "compact") {
    return { ...settings, default_view: "grid" };
  }

  if (!["grid", "list"].includes(storedDefaultView)) {
    return { ...settings, default_view: DEFAULT_LIBRARY_SETTINGS.default_view };
  }

  return settings;
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("You must be signed in.");
  return user.id;
}

function normalizeSettings(row: UserSettingsRow): UserSettings {
  return {
    user_id: row.user_id,
    appearance: mergeSection(DEFAULT_APPEARANCE_SETTINGS, row.appearance),
    reading: mergeSection(DEFAULT_READING_SETTINGS, row.reading),
    library: normalizeLibrarySettings(mergeSection(DEFAULT_LIBRARY_SETTINGS, row.library)),
    collections: mergeSection(DEFAULT_COLLECTION_SETTINGS, row.collections),
    notifications: mergeSection(DEFAULT_NOTIFICATION_SETTINGS, row.notifications),
    privacy: mergeSection(DEFAULT_PRIVACY_SETTINGS, row.privacy),
    backup: mergeSection(DEFAULT_BACKUP_SETTINGS, row.backup),
    last_seen_release_note_version: row.last_seen_release_note_version ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSettingsPayload(settings: UserSettings): UserSettingsSections & { user_id: string } {
  return {
    user_id: settings.user_id,
    appearance: settings.appearance,
    reading: settings.reading,
    library: settings.library,
    collections: settings.collections,
    notifications: settings.notifications,
    privacy: settings.privacy,
    backup: settings.backup,
  };
}

export function mergeUserSettings(
  settings: UserSettings,
  update: UserSettingsUpdate,
): UserSettings {
  return {
    ...settings,
    appearance: mergeSection(DEFAULT_APPEARANCE_SETTINGS, settings.appearance, update.appearance),
    reading: mergeSection(DEFAULT_READING_SETTINGS, settings.reading, update.reading),
    library: normalizeLibrarySettings(
      mergeSection(DEFAULT_LIBRARY_SETTINGS, settings.library, update.library),
    ),
    collections: mergeSection(DEFAULT_COLLECTION_SETTINGS, settings.collections, update.collections),
    notifications: mergeSection(
      DEFAULT_NOTIFICATION_SETTINGS,
      settings.notifications,
      update.notifications,
    ),
    privacy: mergeSection(DEFAULT_PRIVACY_SETTINGS, settings.privacy, update.privacy),
    backup: mergeSection(DEFAULT_BACKUP_SETTINGS, settings.backup, update.backup),
  };
}

export async function getMySettings(): Promise<UserSettings> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return normalizeSettings(data as UserSettingsRow);

  const { data: insertedData, error: insertError } = await supabase
    .from("user_settings")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return normalizeSettings(insertedData as UserSettingsRow);
}

export async function upsertMySettings(update: UserSettingsUpdate): Promise<UserSettings> {
  const currentSettings = await getMySettings();
  const nextSettings = mergeUserSettings(currentSettings, update);
  const { data, error } = await supabase
    .from("user_settings")
    .upsert(toSettingsPayload(nextSettings), { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeSettings(data as UserSettingsRow);
}

export async function markReleaseNoteAsSeen(
  version: string,
): Promise<UserSettings> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .update({ last_seen_release_note_version: version })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return normalizeSettings(data as UserSettingsRow);
}

export function buildSectionUpdate<Key extends SettingsSectionKey>(
  section: Key,
  values: Partial<UserSettingsSections[Key]>,
): UserSettingsUpdate {
  return {
    [section]: values,
  } as UserSettingsUpdate;
}
