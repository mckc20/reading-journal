import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Bell,
  BookOpen,
  Database,
  Download,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  Save,
  Shield,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
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
import { useAuth, useProfile, useTheme, useUserSettings } from "@/context";
import { getErrorMessage } from "@/lib/profiles";
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

type SettingsTab =
  | "profile"
  | "appearance"
  | "reading"
  | "notifications"
  | "account"
  | "about";

type ProfileSettingsForm = {
  display_name: string;
  username: string;
  avatar_url: string;
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
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "account", label: "Account", icon: Shield },
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
  { value: "Wishlist", label: "Wishlist" },
  { value: "Not Started", label: "Not Started" },
  { value: "Up Next", label: "Up Next" },
  { value: "Reading", label: "Reading" },
  { value: "Finished", label: "Finished" },
  { value: "DNF", label: "DNF" },
] satisfies Array<SelectOption<BookStatus>>;

const paceOptions = [
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
  { value: "gallery", label: "Gallery" },
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
    avatar_url: profile?.avatar_url ?? "",
    bio: profile?.bio ?? "",
  };
}

function cleanProfileSettingsForm(form: ProfileSettingsForm) {
  const username = form.username.trim().toLowerCase();

  return {
    display_name: form.display_name.trim() || undefined,
    username: username || undefined,
    avatar_url: form.avatar_url.trim() || undefined,
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(profileToSettingsForm(profile));
  }, [profile]);

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
      const savedProfile = await saveProfile(cleanForm);
      setForm(profileToSettingsForm(savedProfile));
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
          <Label htmlFor="avatar-url">Avatar URL</Label>
          <Input
            id="avatar-url"
            value={form.avatar_url}
            disabled={loading}
            onChange={(event) => setForm({ ...form, avatar_url: event.target.value })}
          />
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
          <SettingRow title="Reading pace calculation">
            <SelectSetting
              value={reading.reading_pace_calculation}
              options={paceOptions}
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
            <DisabledActionButton icon={Download}>Export notes</DisabledActionButton>
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
  return (
    <SettingsSection
      title="About"
      description="Project information and support links."
      icon={Info}
    >
      <SettingsRows>
        <SettingRow title="App version">
          <span className="text-sm text-muted-foreground">{APP_VERSION}</span>
        </SettingRow>
        <SettingRow title="Changelog">
          <Button type="button" variant="outline" size="sm" disabled>
            View changelog
          </Button>
        </SettingRow>
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

function SettingsTabContent({ tab }: { tab: SettingsTab }) {
  if (tab === "profile") return <ProfileSettings />;
  if (tab === "appearance") return <AppearanceSettings />;
  if (tab === "reading") return <ReadingSettings />;
  if (tab === "notifications") return <NotificationSettings />;
  if (tab === "account") return <AccountSettings />;
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
        <h1 className="text-2xl font-heading leading-snug font-medium">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage your profile, app preferences, reading defaults, notifications, and account.
        </p>
      </div>

      <SettingsTabs activeTab={activeTab} />

      <section>
        <SettingsTabContent tab={activeTab} />
      </section>
    </div>
  );
}
