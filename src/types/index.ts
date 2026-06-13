export type BookStatus =
  | "Wishlist"
  | "Not Started"
  | "Up Next"
  | "Reading"
  | "Finished"
  | "DNF";

export type BookLanguage = "German" | "Spanish" | "English";

export type BookSource = "Owned" | "Family" | "Friends" | "Library";

export type BookFormat = "eBook" | "Audiobook" | "Paperback" | "Hardcover";

export type BookMetadataSource = "open_library" | "google_books";

export type PublicationDatePrecision = "year" | "month" | "day";

export interface Series {
  id: string;
  name: string;
  journal_content?: string;
  user_id: string;
  created_at: string;
}

export interface Genre {
  id: string;
  name: string;
  parent_id?: string | null;
  user_id?: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenreTreeNode extends Genre {
  children: GenreTreeNode[];
  depth: number;
  path: Genre[];
  pathLabel: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  genre_ids?: string[];
  selected_genres?: Genre[];
  genre_paths?: string[];
  genres?: string[];
  status: BookStatus;
  cover_url?: string;
  rating?: number | null; // 1-5, or null when unrated
  is_favorite: boolean;
  current_page?: number;
  total_pages?: number;
  date_started?: string;
  date_finished?: string;
  language?: BookLanguage;
  source?: BookSource;
  format?: BookFormat;
  isbn?: string;
  publisher?: string | null;
  publication_date?: string | null;
  publication_date_precision?: PublicationDatePrecision | null;
  description?: string | null;
  metadata_source?: BookMetadataSource | null;
  metadata_source_url?: string | null;
  series_id?: string;
  volume_number?: number;
  user_id: string;
  created_at: string;
}

export type BookUpdate = Partial<Omit<Book, "id" | "user_id" | "created_at">>;

export type BookNoteLabel = "quote" | "review" | "note";

export interface BookNote {
  id: string;
  user_id: string;
  book_id: string;
  label: BookNoteLabel;
  title?: string | null;
  quote_speaker?: string | null;
  content: string;
  page_start?: number | null;
  is_favorite: boolean;
  note_date: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingLog {
  id: string;
  book_id: string;
  user_id: string;
  current_page: number;
  reading_time_minutes?: number;
  logged_at: string;
}

export interface Profile {
  id: string;
  display_name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  created_at: string;
}

export type SettingsTheme = "light" | "dark" | "system";

export type AccentColor = "default" | "rose" | "orange" | "green" | "blue" | "violet";

export type BookCoverStyle = "rounded" | "square" | "soft";

export type CornerRadiusStyle = "none" | "small" | "medium" | "large";

export type FontSizePreference = "small" | "medium" | "large";

export type DensityPreference = "comfortable" | "compact" | "spacious";

export interface AppearanceSettings {
  theme: SettingsTheme;
  accent_color: AccentColor;
  compact_mode: boolean;
  reduced_animations: boolean;
  book_cover_style: BookCoverStyle;
  corner_radius: CornerRadiusStyle;
  font_size: FontSizePreference;
  density: DensityPreference;
}

export type ReadingPaceCalculation = "recent_logs" | "all_logs" | "manual";

export type ProgressDisplay = "percentage" | "pages" | "both";

export interface ReadingSettings {
  default_reading_status: BookStatus;
  reading_pace_calculation: ReadingPaceCalculation;
  progress_display: ProgressDisplay;
  reading_streak_enabled: boolean;
  reading_streak_goal_days: number;
  auto_finish_books: boolean;
  estimated_completion_dates: boolean;
}

export type LibrarySorting = "recently_added" | "title" | "author" | "rating" | "status";

export type LibraryView = "grid" | "list" | "gallery";

export interface LibrarySettings {
  default_sorting: LibrarySorting;
  default_view: LibraryView;
  default_filters: Record<string, string>;
  show_unfinished_series_first: boolean;
  hide_completed_books: boolean;
  show_reading_statistics: boolean;
}

export type CollectionVisibility = "private" | "followers" | "public";

export type CollectionBehavior = "manual" | "smart" | "manual_and_smart";

export interface CollectionSettings {
  collection_visibility: CollectionVisibility;
  automatic_collections: boolean;
  smart_collections: boolean;
  collection_behavior: CollectionBehavior;
}

export interface NotificationSettings {
  reading_reminders: boolean;
  weekly_summary: boolean;
  daily_goal_reminders: boolean;
  goal_completion_notifications: boolean;
  friend_activity_notifications: boolean;
  new_follower_notifications: boolean;
}

export interface PrivacySettings {
  private_account: boolean;
  show_reading_activity: boolean;
  show_reading_statistics_publicly: boolean;
  show_reading_goals_publicly: boolean;
  allow_followers: boolean;
  blocked_users: string[];
}

export type BackupFrequency = "manual" | "daily" | "weekly" | "monthly";

export interface BackupSettings {
  automatic_backups: boolean;
  backup_frequency: BackupFrequency;
  last_backup_at: string | null;
}

export interface UserSettings {
  user_id: string;
  appearance: AppearanceSettings;
  reading: ReadingSettings;
  library: LibrarySettings;
  collections: CollectionSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  backup: BackupSettings;
  created_at: string;
  updated_at: string;
}

export type UserSettingsSections = Pick<
  UserSettings,
  "appearance" | "reading" | "library" | "collections" | "notifications" | "privacy" | "backup"
>;

export type UserSettingsUpdate = {
  [Key in keyof UserSettingsSections]?: Partial<UserSettingsSections[Key]>;
};

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  created_at: string;
}

export type GroupMembershipRole = "owner" | "admin" | "member";

export type GroupMembershipStatus = "active" | "invited";

export interface GroupMembership {
  group_id: string;
  user_id: string;
  role: GroupMembershipRole;
  status: GroupMembershipStatus;
  joined_at: string;
}
