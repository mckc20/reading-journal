import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Check,
  Copy,
  Database,
  Download,
  ImagePlus,
  Info,
  KeyRound,
  Lock,
  ListTree,
  LogOut,
  Monitor,
  Plus,
  Save,
  Shield,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import SetPasswordDialog from "@/components/SetPasswordDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, useProfile, useTheme, useUserSettings } from "@/context";
import { useGenresContext } from "@/context/GenresContext";
import { getErrorMessage } from "@/lib/profiles";
import { flattenGenreTree, isGenreRoot } from "@/lib/genres";
import { RELEASE_NOTES_EVENT } from "@/components/ReleaseNotesDialog";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_BACKUP_SETTINGS,
  DEFAULT_COLLECTION_SETTINGS,
  DEFAULT_LIBRARY_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_READING_SETTINGS,
} from "@/lib/userSettings";
import { cn } from "@/lib/utils";
import type {
  AccentColor,
  ApiKeySummary,
  AppearanceSettings as AppearanceSettingsValues,
  BackupFrequency,
  BookCoverStyle,
  BookStatus,
  CollectionBehavior,
  CollectionSettings as CollectionSettingsValues,
  CollectionVisibility,
  CornerRadiusStyle,
  DensityPreference,
  FontSizePreference,
  LibrarySettings as LibrarySettingsValues,
  LibrarySorting,
  LibraryView,
  NotificationSettings as NotificationSettingsValues,
  PrivacySettings as PrivacySettingsValues,
  ProgressDisplay,
  ReadingPaceCalculation,
  ReadingSettings as ReadingSettingsValues,
} from "@/types";
import { getLatestReleaseNote, hasUnreadReleaseNote } from "@/lib/releaseNotes";
import { createApiKey, listApiKeys, revokeApiKey, type CreatedApiKey } from "@/lib/apiKeys";

type SettingsTab =
  | "profile"
  | "appearance"
  | "reading"
  | "genres"
  | "notifications"
  | "account"
  | "api-keys"
  | "about";

type ProfileSettingsForm = {
  display_name: string;
  username: string;
  bio: string;
};

type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

const APP_VERSION = "0.0.0";

const settingsTabs: Array<{
  value: SettingsTab;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "appearance", label: "Appearance", icon: Monitor },
  { value: "reading", label: "Reading", icon: BookOpen },
  { value: "genres", label: "Genres", icon: ListTree },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "account", label: "Account", icon: Shield },
  { value: "api-keys", label: "API Keys", icon: KeyRound },
  { value: "about", label: "About", icon: Info },
];

const legacyTabRedirects: Record<string, SettingsTab> = {
  notification: "notifications",
};

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] satisfies Array<SelectOption<AppearanceSettingsValues["theme"]>>;

const accentColorOptions = [
  { value: "default", label: "Default" },
  { value: "rose", label: "Rose" },
  { value: "orange", label: "Orange" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
] satisfies Array<SelectOption<AccentColor>>;

const bookCoverStyleOptions = [
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "soft", label: "Soft" },
] satisfies Array<SelectOption<BookCoverStyle>>;

const cornerRadiusOptions = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] satisfies Array<SelectOption<CornerRadiusStyle>>;

const fontSizeOptions = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] satisfies Array<SelectOption<FontSizePreference>>;

const densityOptions = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
  { value: "spacious", label: "Spacious" },
] satisfies Array<SelectOption<DensityPreference>>;

const statusOptions = [
  { value: "To Read", label: "To Read" },
  { value: "Up Next", label: "Up Next" },
  { value: "Reading", label: "Reading" },
  { value: "Finished", label: "Finished" },
  { value: "DNF", label: "DNF" },
] satisfies Array<SelectOption<BookStatus>>;

const speedCalculationOptions = [
  { value: "recent_logs", label: "Recent logs" },
  { value: "all_logs", label: "All logs" },
  { value: "manual", label: "Manual" },
] satisfies Array<SelectOption<ReadingPaceCalculation>>;

const progressDisplayOptions = [
  { value: "percentage", label: "Percentage" },
  { value: "pages", label: "Pages" },
  { value: "both", label: "Both" },
] satisfies Array<SelectOption<ProgressDisplay>>;

const librarySortingOptions = [
  { value: "recently_added", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "rating", label: "Rating" },
  { value: "status", label: "Status" },
] satisfies Array<SelectOption<LibrarySorting>>;

const libraryViewOptions = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
] satisfies Array<SelectOption<LibraryView>>;

const collectionVisibilityOptions = [
  { value: "private", label: "Private" },
  { value: "followers", label: "Followers" },
  { value: "public", label: "Public" },
] satisfies Array<SelectOption<CollectionVisibility>>;

const collectionBehaviorOptions = [
  { value: "manual", label: "Manual" },
  { value: "smart", label: "Smart" },
  { value: "manual_and_smart", label: "Manual and smart" },
] satisfies Array<SelectOption<CollectionBehavior>>;

const backupFrequencyOptions = [
  { value: "manual", label: "Manual" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] satisfies Array<SelectOption<BackupFrequency>>;

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return settingsTabs.some((tab) => tab.value === value);
}

function getSettingsTab(value: string | undefined): SettingsTab | null {
  if (!value) return "profile";
  if (isSettingsTab(value)) return value;
  return legacyTabRedirects[value] ?? null;
}

function profileToSettingsForm(profile: ReturnType<typeof useProfile>["profile"]): ProfileSettingsForm {
  const fallbackName = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return {
    display_name: profile?.display_name ?? fallbackName,
    username: profile?.username ?? "",
    bio: profile?.bio ?? "",
  };
}

function cleanProfileSettingsForm(form: ProfileSettingsForm) {
  const username = form.username.trim().toLowerCase();

  return {
    display_name: form.display_name.trim() || undefined,
    username: username || undefined,
    bio: form.bio.trim() || undefined,
  };
}

function isValidUsername(username: string): boolean {
  return username === "" || /^[a-z0-9_]{3,30}$/.test(username);
}

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SettingsRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border rounded-lg border">{children}</div>;
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </div>
  );
}

function SelectSetting<TValue extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: TValue;
  options: Array<SelectOption<TValue>>;
  onChange: (value: TValue) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as TValue)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-52">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleSetting({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={checked ? "default" : "outline"}
      size="sm"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className="w-full sm:w-28"
    >
      {checked ? "On" : "Off"}
    </Button>
  );
}

function NumberSetting({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      min={1}
      max={365}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (Number.isFinite(nextValue) && nextValue >= 1) {
          onChange(Math.min(nextValue, 365));
        }
      }}
      className="w-full sm:w-28"
    />
  );
}

function DisabledActionButton({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="outline" disabled className="justify-start">
      {Icon && <Icon className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

function ProfileSettings() {
  const { profile, loading, error: profileError, saveProfile } = useProfile();
  const [form, setForm] = useState<ProfileSettingsForm>(() => profileToSettingsForm(profile));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(profileToSettingsForm(profile));
  }, [profile]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);

  const currentAvatarUrl = removeAvatar ? null : avatarPreviewUrl ?? profile?.avatar_url?.trim() ?? null;
  const avatarAlt = profile?.display_name?.trim() || profile?.username?.trim() || "Profile avatar";

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    setRemoveAvatar(false);
    event.target.value = "";
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
    setRemoveAvatar(true);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanForm = cleanProfileSettingsForm(form);

    setSaving(true);
    setMessage(null);
    setError(null);

    if (!isValidUsername(cleanForm.username ?? "")) {
      setSaving(false);
      setError("Username must be 3-30 characters and use lowercase letters, numbers, or underscores.");
      return;
    }

    try {
      const savedProfile = await saveProfile({
        ...cleanForm,
        avatar_file: avatarFile,
        remove_avatar: removeAvatar,
      });
      setForm(profileToSettingsForm(savedProfile));
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setRemoveAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title="Profile"
      description="Personal information shown around your reading journal."
      icon={UserRound}
    >
      <form className="space-y-4" onSubmit={submitProfile}>
        {profileError && <p className="text-sm text-destructive">{profileError}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="grid gap-4 sm:grid-cols-[9rem_1fr] sm:items-start">
          <div className="space-y-2">
            <Label>Profile photo</Label>
            <div className="flex flex-col items-start gap-2">
              <label className="group relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm">
                {currentAvatarUrl ? (
                  <img src={currentAvatarUrl} alt={avatarAlt} className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/70" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus className="h-5 w-5 text-white" />
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  ref={avatarInputRef}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={loading}
                  onChange={handleAvatarChange}
                />
              </label>
              {(currentAvatarUrl || avatarFile || removeAvatar) && (
                <Button type="button" variant="ghost" onClick={handleRemoveAvatar} className="gap-2 px-2" disabled={loading}>
                  <Trash2 className="h-4 w-4" />
                  Remove photo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or AVIF. Click the photo to upload.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={form.display_name}
                  disabled={loading}
                  onChange={(event) => setForm({ ...form, display_name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  disabled={loading}
                  placeholder="martina_reads"
                  onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                disabled={loading}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
              />
            </div>
          </div>
        </div>

        <Button type="submit" disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save profile"}
        </Button>
      </form>
    </SettingsSection>
  );
}

function AppearanceSettings() {
  const { setTheme } = useTheme();
  const { settings, loading, saving, error, saveSettingsSection } = useUserSettings();
  const appearance = settings?.appearance ?? DEFAULT_APPEARANCE_SETTINGS;
  const disabled = loading || saving;

  async function saveAppearance(update: Partial<AppearanceSettingsValues>) {
    if (update.theme) setTheme(update.theme);
    await saveSettingsSection("appearance", update);
  }

  return (
    <SettingsSection
      title="Appearance"
      description="Controls for how the app looks and feels."
      icon={Monitor}
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SettingsRows>
          <SettingRow title="Theme">
            <SelectSetting
              value={appearance.theme}
              options={themeOptions}
              disabled={disabled}
              onChange={(theme) => void saveAppearance({ theme })}
            />
          </SettingRow>
          <SettingRow title="Accent color">
            <SelectSetting
              value={appearance.accent_color}
              options={accentColorOptions}
              disabled={disabled}
              onChange={(accent_color) => void saveAppearance({ accent_color })}
            />
          </SettingRow>
          <SettingRow title="Compact mode">
            <ToggleSetting
              checked={appearance.compact_mode}
              disabled={disabled}
              onChange={(compact_mode) => void saveAppearance({ compact_mode })}
            />
          </SettingRow>
          <SettingRow title="Reduced animations">
            <ToggleSetting
              checked={appearance.reduced_animations}
              disabled={disabled}
              onChange={(reduced_animations) => void saveAppearance({ reduced_animations })}
            />
          </SettingRow>
          <SettingRow title="Book cover style">
            <SelectSetting
              value={appearance.book_cover_style}
              options={bookCoverStyleOptions}
              disabled={disabled}
              onChange={(book_cover_style) => void saveAppearance({ book_cover_style })}
            />
          </SettingRow>
          <SettingRow title="Corner radius style">
            <SelectSetting
              value={appearance.corner_radius}
              options={cornerRadiusOptions}
              disabled={disabled}
              onChange={(corner_radius) => void saveAppearance({ corner_radius })}
            />
          </SettingRow>
          <SettingRow title="Font size">
            <SelectSetting
              value={appearance.font_size}
              options={fontSizeOptions}
              disabled={disabled}
              onChange={(font_size) => void saveAppearance({ font_size })}
            />
          </SettingRow>
          <SettingRow title="Density">
            <SelectSetting
              value={appearance.density}
              options={densityOptions}
              disabled={disabled}
              onChange={(density) => void saveAppearance({ density })}
            />
          </SettingRow>
        </SettingsRows>
      </div>
    </SettingsSection>
  );
}

function ReadingSettings() {
  const { settings, loading, saving, error, saveSettingsSection } = useUserSettings();
  const reading = settings?.reading ?? DEFAULT_READING_SETTINGS;
  const library = settings?.library ?? DEFAULT_LIBRARY_SETTINGS;
  const collections = settings?.collections ?? DEFAULT_COLLECTION_SETTINGS;
  const disabled = loading || saving;

  const saveReading = (update: Partial<ReadingSettingsValues>) =>
    saveSettingsSection("reading", update);
  const saveLibrary = (update: Partial<LibrarySettingsValues>) =>
    saveSettingsSection("library", update);
  const saveCollections = (update: Partial<CollectionSettingsValues>) =>
    saveSettingsSection("collections", update);
  const saveJournalFilterDefault = (
    key: keyof ReadingSettingsValues["journal_filter_defaults"],
    checked: boolean,
  ) => saveReading({
    journal_filter_defaults: {
      ...reading.journal_filter_defaults,
      [key]: checked,
    },
  });

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <SettingsSection
        title="Reading"
        description="Preferences for how you track reading progress."
        icon={BookOpen}
      >
        <SettingsRows>
          <SettingRow title="Default reading status">
            <SelectSetting
              value={reading.default_reading_status}
              options={statusOptions}
              disabled={disabled}
              onChange={(default_reading_status) => void saveReading({ default_reading_status })}
            />
          </SettingRow>
          <SettingRow title="Reading speed calculation">
            <SelectSetting
              value={reading.reading_pace_calculation}
              options={speedCalculationOptions}
              disabled={disabled}
              onChange={(reading_pace_calculation) =>
                void saveReading({ reading_pace_calculation })
              }
            />
          </SettingRow>
          <SettingRow title="Progress display">
            <SelectSetting
              value={reading.progress_display}
              options={progressDisplayOptions}
              disabled={disabled}
              onChange={(progress_display) => void saveReading({ progress_display })}
            />
          </SettingRow>
          <SettingRow title="Reading streak settings" description="Goal length in days.">
            <div className="flex gap-2">
              <ToggleSetting
                checked={reading.reading_streak_enabled}
                disabled={disabled}
                onChange={(reading_streak_enabled) =>
                  void saveReading({ reading_streak_enabled })
                }
              />
              <NumberSetting
                value={reading.reading_streak_goal_days}
                disabled={disabled || !reading.reading_streak_enabled}
                onChange={(reading_streak_goal_days) =>
                  void saveReading({ reading_streak_goal_days })
                }
              />
            </div>
          </SettingRow>
          <SettingRow title="Auto-finish books">
            <ToggleSetting
              checked={reading.auto_finish_books}
              disabled={disabled}
              onChange={(auto_finish_books) => void saveReading({ auto_finish_books })}
            />
          </SettingRow>
          <SettingRow title="Estimated completion dates">
            <ToggleSetting
              checked={reading.estimated_completion_dates}
              disabled={disabled}
              onChange={(estimated_completion_dates) =>
                void saveReading({ estimated_completion_dates })
              }
            />
          </SettingRow>
          <SettingRow
            title="Journal filter defaults"
            description="Choose which journal filters start turned on when you open a journal."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Quotes</span>
                <ToggleSetting
                  checked={reading.journal_filter_defaults.show_quotes}
                  disabled={disabled}
                  onChange={(checked) => void saveJournalFilterDefault("show_quotes", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Thoughts</span>
                <ToggleSetting
                  checked={reading.journal_filter_defaults.show_thoughts}
                  disabled={disabled}
                  onChange={(checked) => void saveJournalFilterDefault("show_thoughts", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Automatic</span>
                <ToggleSetting
                  checked={reading.journal_filter_defaults.show_automatic}
                  disabled={disabled}
                  onChange={(checked) => void saveJournalFilterDefault("show_automatic", checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">From books</span>
                <ToggleSetting
                  checked={reading.journal_filter_defaults.show_from_books}
                  disabled={disabled}
                  onChange={(checked) => void saveJournalFilterDefault("show_from_books", checked)}
                />
              </div>
            </div>
          </SettingRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection
        title="Library"
        description="Defaults for sorting, filtering, and viewing your books."
      >
        <SettingsRows>
          <SettingRow title="Default sorting">
            <SelectSetting
              value={library.default_sorting}
              options={librarySortingOptions}
              disabled={disabled}
              onChange={(default_sorting) => void saveLibrary({ default_sorting })}
            />
          </SettingRow>
          <SettingRow title="Default view">
            <SelectSetting
              value={library.default_view}
              options={libraryViewOptions}
              disabled={disabled}
              onChange={(default_view) => void saveLibrary({ default_view })}
            />
          </SettingRow>
          <SettingRow title="Default filters" description="Reserved for saved filter presets.">
            <span className="text-xs text-muted-foreground">No filters selected</span>
          </SettingRow>
          <SettingRow title="Show unfinished series first">
            <ToggleSetting
              checked={library.show_unfinished_series_first}
              disabled={disabled}
              onChange={(show_unfinished_series_first) =>
                void saveLibrary({ show_unfinished_series_first })
              }
            />
          </SettingRow>
          <SettingRow title="Hide completed books">
            <ToggleSetting
              checked={library.hide_completed_books}
              disabled={disabled}
              onChange={(hide_completed_books) => void saveLibrary({ hide_completed_books })}
            />
          </SettingRow>
          <SettingRow title="Show reading statistics">
            <ToggleSetting
              checked={library.show_reading_statistics}
              disabled={disabled}
              onChange={(show_reading_statistics) =>
                void saveLibrary({ show_reading_statistics })
              }
            />
          </SettingRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection
        title="Collections"
        description="How shelves and smart collections should behave."
      >
        <SettingsRows>
          <SettingRow title="Collection visibility">
            <SelectSetting
              value={collections.collection_visibility}
              options={collectionVisibilityOptions}
              disabled={disabled}
              onChange={(collection_visibility) =>
                void saveCollections({ collection_visibility })
              }
            />
          </SettingRow>
          <SettingRow title="Automatic collections">
            <ToggleSetting
              checked={collections.automatic_collections}
              disabled={disabled}
              onChange={(automatic_collections) =>
                void saveCollections({ automatic_collections })
              }
            />
          </SettingRow>
          <SettingRow title="Smart collections">
            <ToggleSetting
              checked={collections.smart_collections}
              disabled={disabled}
              onChange={(smart_collections) => void saveCollections({ smart_collections })}
            />
          </SettingRow>
          <SettingRow title="Collection behavior">
            <SelectSetting
              value={collections.collection_behavior}
              options={collectionBehaviorOptions}
              disabled={disabled}
              onChange={(collection_behavior) =>
                void saveCollections({ collection_behavior })
              }
            />
          </SettingRow>
        </SettingsRows>
      </SettingsSection>
    </div>
  );
}

function NotificationSettings() {
  const { settings, loading, saving, error, saveSettingsSection } = useUserSettings();
  const notifications = settings?.notifications ?? DEFAULT_NOTIFICATION_SETTINGS;
  const disabled = loading || saving;

  function saveNotifications(update: Partial<NotificationSettingsValues>) {
    return saveSettingsSection("notifications", update);
  }

  return (
    <SettingsSection
      title="Notifications"
      description="Reminders and social updates for your reading activity."
      icon={Bell}
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <SettingsRows>
          <SettingRow title="Reading reminders">
            <ToggleSetting
              checked={notifications.reading_reminders}
              disabled={disabled}
              onChange={(reading_reminders) =>
                void saveNotifications({ reading_reminders })
              }
            />
          </SettingRow>
          <SettingRow title="Weekly summary">
            <ToggleSetting
              checked={notifications.weekly_summary}
              disabled={disabled}
              onChange={(weekly_summary) => void saveNotifications({ weekly_summary })}
            />
          </SettingRow>
          <SettingRow title="Daily goal reminders">
            <ToggleSetting
              checked={notifications.daily_goal_reminders}
              disabled={disabled}
              onChange={(daily_goal_reminders) =>
                void saveNotifications({ daily_goal_reminders })
              }
            />
          </SettingRow>
          <SettingRow title="Goal completion notifications">
            <ToggleSetting
              checked={notifications.goal_completion_notifications}
              disabled={disabled}
              onChange={(goal_completion_notifications) =>
                void saveNotifications({ goal_completion_notifications })
              }
            />
          </SettingRow>
          <SettingRow title="Friend activity notifications">
            <ToggleSetting
              checked={notifications.friend_activity_notifications}
              disabled={disabled}
              onChange={(friend_activity_notifications) =>
                void saveNotifications({ friend_activity_notifications })
              }
            />
          </SettingRow>
          <SettingRow title="New follower notifications">
            <ToggleSetting
              checked={notifications.new_follower_notifications}
              disabled={disabled}
              onChange={(new_follower_notifications) =>
                void saveNotifications({ new_follower_notifications })
              }
            />
          </SettingRow>
        </SettingsRows>
      </div>
    </SettingsSection>
  );
}

function formatApiKeyDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ApiKeysSettings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadKeys() {
      setLoading(true);
      setError(null);

      try {
        const nextKeys = await listApiKeys();
        if (active) setKeys(nextKeys);
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError, "Could not load API keys."));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadKeys();
    return () => {
      active = false;
    };
  }, []);

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    if (!open) {
      setKeyName("");
      setCreateError(null);
    }
  }

  function handleCreatedKeyOpenChange(open: boolean) {
    if (!open) {
      setCreatedKey(null);
      setCopyMessage(null);
    }
  }

  async function submitCreateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setCreateError("You must be signed in to create an API key.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const newKey = await createApiKey(user.id, keyName);
      setKeys((current) => [newKey.key, ...current]);
      setCreateOpen(false);
      setKeyName("");
      setCreatedKey(newKey);
    } catch (createKeyError) {
      setCreateError(getErrorMessage(createKeyError, "Could not create API key."));
    } finally {
      setCreating(false);
    }
  }

  async function copyCreatedKey() {
    if (!createdKey) return;

    setCopyMessage(null);
    try {
      await navigator.clipboard.writeText(createdKey.rawKey);
      setCopyMessage("Copied to clipboard.");
    } catch {
      setCopyMessage("Could not copy automatically. Select the key and copy it manually.");
    }
  }

  async function confirmRevoke() {
    if (!keyToRevoke) return;

    setRevoking(true);
    setError(null);

    try {
      await revokeApiKey(keyToRevoke.id);
      setKeys((current) => current.filter((key) => key.id !== keyToRevoke.id));
      setKeyToRevoke(null);
    } catch (revokeError) {
      setError(getErrorMessage(revokeError, "Could not revoke API key."));
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <SettingsSection
        title="API keys"
        description="Create credentials for the Reading Journal programmatic API."
        icon={KeyRound}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted-foreground">
              API keys work like passwords for apps and shortcuts. Keep them private and revoke a key if you no longer use it.
            </p>
            <Button type="button" onClick={() => setCreateOpen(true)} disabled={loading || !user}>
              <Plus className="mr-2 h-4 w-4" />
              Create key
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading API keys…</p>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              You have not created any API keys yet.
            </div>
          ) : (
            <SettingsRows>
              {keys.map((key) => (
                <SettingRow
                  key={key.id}
                  title={key.name}
                  description={`${key.key_prefix}… · Created ${formatApiKeyDate(key.created_at)} · ${key.last_used_at ? `Last used ${formatApiKeyDate(key.last_used_at)}` : "Never used"}`}
                >
                  <Button type="button" variant="outline" size="sm" onClick={() => setKeyToRevoke(key)}>
                    Revoke
                  </Button>
                </SettingRow>
              ))}
            </SettingsRows>
          )}
        </div>
      </SettingsSection>

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give this key a recognizable name, such as “Phone shortcut” or “Desktop script”.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitCreateKey}>
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Key name</Label>
              <Input
                id="api-key-name"
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="Phone shortcut"
                autoFocus
                disabled={creating}
              />
              {createError && <p className="text-sm text-destructive">{createError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleCreateOpenChange(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !keyName.trim()}>
                {creating ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdKey)} onOpenChange={handleCreatedKeyOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Copy your API key now</DialogTitle>
            <DialogDescription>
              Copy this now — you won’t be able to see it again after closing this dialog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="created-api-key">API key</Label>
            <Input id="created-api-key" value={createdKey?.rawKey ?? ""} readOnly onFocus={(event) => event.currentTarget.select()} />
            {copyMessage && <p className="text-sm text-muted-foreground">{copyMessage}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleCreatedKeyOpenChange(false)}>
              I copied it
            </Button>
            <Button type="button" onClick={() => void copyCreatedKey()}>
              {copyMessage === "Copied to clipboard." ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Copy key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(keyToRevoke)} onOpenChange={(open) => !open && setKeyToRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key?</DialogTitle>
            <DialogDescription>
              {keyToRevoke ? `“${keyToRevoke.name}” will stop working immediately. This cannot be undone.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setKeyToRevoke(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRevoke()} disabled={revoking}>
              {revoking ? "Revoking…" : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountSettings() {
  const { user, signOut } = useAuth();
  const { settings, loading, saving, error, saveSettingsSection } = useUserSettings();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const privacy = settings?.privacy ?? DEFAULT_PRIVACY_SETTINGS;
  const backup = settings?.backup ?? DEFAULT_BACKUP_SETTINGS;
  const disabled = loading || saving;

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user?.email]);

  function savePrivacy(update: Partial<PrivacySettingsValues>) {
    return saveSettingsSection("privacy", update);
  }

  function saveBackup(update: Partial<typeof backup>) {
    return saveSettingsSection("backup", update);
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailSaving(true);
    setEmailMessage(null);
    setEmailError(null);

    try {
      const nextEmail = email.trim();
      if (!nextEmail) throw new Error("Email is required.");
      const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
      if (updateError) throw updateError;
      setEmailMessage("Check your inbox to confirm the email change.");
    } catch (updateError) {
      setEmailError(getErrorMessage(updateError, "Could not update email."));
    } finally {
      setEmailSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <SettingsSection
        title="Security"
        description="Sign-in details for your account."
        icon={KeyRound}
      >
        <div className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitEmail}>
            <div className="space-y-2">
              <Label htmlFor="account-email">Email</Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {emailMessage && <p className="text-sm text-muted-foreground">{emailMessage}</p>}
              {emailError && <p className="text-sm text-destructive">{emailError}</p>}
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={emailSaving || email.trim() === (user?.email ?? "")}
              className="self-end"
            >
              {emailSaving ? "Saving..." : "Change email"}
            </Button>
          </form>

          <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Change password
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Privacy"
        description="Control what other readers can see."
        icon={Lock}
      >
        <SettingsRows>
          <SettingRow title="Private account">
            <ToggleSetting
              checked={privacy.private_account}
              disabled={disabled}
              onChange={(private_account) => void savePrivacy({ private_account })}
            />
          </SettingRow>
          <SettingRow title="Show reading activity">
            <ToggleSetting
              checked={privacy.show_reading_activity}
              disabled={disabled}
              onChange={(show_reading_activity) =>
                void savePrivacy({ show_reading_activity })
              }
            />
          </SettingRow>
          <SettingRow title="Show reading statistics publicly">
            <ToggleSetting
              checked={privacy.show_reading_statistics_publicly}
              disabled={disabled}
              onChange={(show_reading_statistics_publicly) =>
                void savePrivacy({ show_reading_statistics_publicly })
              }
            />
          </SettingRow>
          <SettingRow title="Show reading goals publicly">
            <ToggleSetting
              checked={privacy.show_reading_goals_publicly}
              disabled={disabled}
              onChange={(show_reading_goals_publicly) =>
                void savePrivacy({ show_reading_goals_publicly })
              }
            />
          </SettingRow>
          <SettingRow title="Allow followers">
            <ToggleSetting
              checked={privacy.allow_followers}
              disabled={disabled}
              onChange={(allow_followers) => void savePrivacy({ allow_followers })}
            />
          </SettingRow>
          <SettingRow title="Blocked users" description="Blocking management will come with social features.">
            <span className="text-xs text-muted-foreground">
              {privacy.blocked_users.length} blocked
            </span>
          </SettingRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection
        title="Data & Backup"
        description="Exports, imports, and restore options."
        icon={Database}
      >
        <div className="space-y-4">
          <SettingsRows>
            <SettingRow title="Backup settings">
              <ToggleSetting
                checked={backup.automatic_backups}
                disabled={disabled}
                onChange={(automatic_backups) => void saveBackup({ automatic_backups })}
              />
            </SettingRow>
            <SettingRow title="Backup frequency">
              <SelectSetting
                value={backup.backup_frequency}
                options={backupFrequencyOptions}
                disabled={disabled || !backup.automatic_backups}
                onChange={(backup_frequency) => void saveBackup({ backup_frequency })}
              />
            </SettingRow>
          </SettingsRows>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <DisabledActionButton icon={Download}>Export library</DisabledActionButton>
            <DisabledActionButton icon={Download}>Export journal entries</DisabledActionButton>
            <DisabledActionButton icon={Download}>Export quotes</DisabledActionButton>
            <DisabledActionButton icon={Upload}>Import data</DisabledActionButton>
            <DisabledActionButton>Restore backup</DisabledActionButton>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Danger Zone" description="Account exit and deletion actions.">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
          <Button type="button" variant="destructive" disabled>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete account
          </Button>
        </div>
      </SettingsSection>

      <SetPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

function AboutSettings() {
  const { settings, loading } = useUserSettings();
  const latestReleaseNote = getLatestReleaseNote();
  const showReleaseNotes = !loading && hasUnreadReleaseNote(settings?.last_seen_release_note_version);

  return (
    <SettingsSection
      title="About"
      description="Project information and support links."
      icon={Info}
    >
      <SettingsRows>
        <SettingRow title="App version">
          <span className="text-sm text-muted-foreground">
            {APP_VERSION}
            {showReleaseNotes ? ` · update ${latestReleaseNote.version} available` : ""}
          </span>
        </SettingRow>
        <SettingRow title="Changelog">
          <Button asChild variant="outline" size="sm">
            <Link to="/changelog">Open changelog</Link>
          </Button>
        </SettingRow>
        {showReleaseNotes && (
          <SettingRow title="What's new">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.dispatchEvent(new Event(RELEASE_NOTES_EVENT))}
            >
              Open release journalEntries
            </Button>
          </SettingRow>
        )}
        <SettingRow title="Documentation">
          <Button type="button" variant="outline" size="sm" disabled>
            Open docs
          </Button>
        </SettingRow>
        <SettingRow title="GitHub">
          <Button type="button" variant="outline" size="sm" disabled>
            Open GitHub
          </Button>
        </SettingRow>
        <SettingRow title="Report bug">
          <Button type="button" variant="outline" size="sm" disabled>
            Report bug
          </Button>
        </SettingRow>
        <SettingRow title="Feature requests">
          <Button type="button" variant="outline" size="sm" disabled>
            Request feature
          </Button>
        </SettingRow>
        <SettingRow title="Licenses">
          <Button type="button" variant="outline" size="sm" disabled>
            View licenses
          </Button>
        </SettingRow>
      </SettingsRows>
    </SettingsSection>
  );
}

function GenreSettings() {
  const { tree, loading, error } = useGenresContext();
  const flatNodes = flattenGenreTree(tree);

  return (
    <SettingsSection
      title="Genres"
      description="Genres and subgenres are shared categories. You can assign them to books, but the genre list is no longer editable."
      icon={ListTree}
    >
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : flatNodes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No genres are available yet.
        </p>
      ) : (
        <div className="max-h-[34rem] overflow-y-auto rounded-lg border bg-background p-2">
          {flatNodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
              style={{ paddingLeft: `${8 + node.depth * 18}px` }}
            >
              <span className={cn("min-w-0 flex-1 truncate", isGenreRoot(node) && "font-medium")}>
                {node.name}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {node.is_system ? "System" : "Read only"}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

function SettingsTabContent({ tab }: { tab: SettingsTab }) {
  if (tab === "profile") return <ProfileSettings />;
  if (tab === "appearance") return <AppearanceSettings />;
  if (tab === "reading") return <ReadingSettings />;
  if (tab === "genres") return <GenreSettings />;
  if (tab === "notifications") return <NotificationSettings />;
  if (tab === "account") return <AccountSettings />;
  if (tab === "api-keys") return <ApiKeysSettings />;
  return <AboutSettings />;
}

function SettingsTabs({ activeTab }: { activeTab: SettingsTab }) {
  return (
    <nav
      className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
      aria-label="Settings sections"
    >
      <div className="flex min-w-max gap-1 rounded-lg bg-muted p-1 md:min-w-0">
        {settingsTabs.map(({ value, label, icon: Icon }) => {
          const active = value === activeTab;

          return (
            <Button
              key={value}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="sm"
              asChild
              className={cn(
                "flex-1 justify-center",
                active && "bg-background shadow-sm hover:bg-background",
              )}
            >
              <Link to={`/settings/${value}`} aria-current={active ? "page" : undefined}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

export default function Settings() {
  const { tab } = useParams();
  const activeTab = getSettingsTab(tab);

  if (!activeTab) {
    return <Navigate to="/settings/profile" replace />;
  }

  if (tab !== activeTab) {
    return <Navigate to={`/settings/${activeTab}`} replace />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-2">
        <AppHeading level={1} as="h1">Settings</AppHeading>
        <HeadingDescription className="max-w-2xl">
          Manage your profile, app preferences, reading defaults, notifications, and account.
        </HeadingDescription>
      </div>

      <SettingsTabs activeTab={activeTab} />

      <section>
        <SettingsTabContent tab={activeTab} />
      </section>
    </div>
  );
}
