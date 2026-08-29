export type BookStatus =
  | "To Read"
  | "Up Next"
  | "Reading"
  | "Paused"
  | "Finished"
  | "DNF";

export type BookLanguage = "German" | "Spanish" | "English";

export type BookSource = "Owned" | "Family" | "Friends" | "Library";

export type BookFormat = "eBook" | "Audiobook" | "Paperback" | "Hardcover";

export type BookMetadataSource = "open_library" | "google_books";

export type SeriesStatus = "ongoing" | "completed";

export interface ApiKeySummary {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface Series {
  id: string;
  name: string;
  description?: string | null;
  status: SeriesStatus;
  is_favorite: boolean;
  cover_url?: string | null;
  journal_content?: string;
  user_id: string;
  created_at: string;
}

export interface Author {
  id: string;
  user_id: string;
  name: string;
  photo_url?: string | null;
  bio?: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Genre {
  id: string;
  name: string;
  description?: string | null;
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
  publication_date?: string | null;
  description?: string | null;
  metadata_source?: BookMetadataSource | null;
  metadata_source_url?: string | null;
  series_id?: string;
  volume_number?: number;
  pause_periods?: BookPausePeriod[];
  user_id: string;
  created_at: string;
}

export interface BookPausePeriod {
  id: string;
  book_id: string;
  user_id: string;
  paused_at: string;
  resumed_at?: string | null;
  created_at: string;
}

export type BookUpdate = Partial<Omit<Book, "id" | "user_id" | "created_at">>;

export type JournalEntryLabel = "quote" | "review" | "note";

export interface BookJournalEntryRecord {
  id: string;
  public_id?: string;
  user_id: string;
  book_id: string;
  parent_entry_id?: string | null;
  label: JournalEntryLabel;
  attribution?: string | null;
  content: string;
  tags?: string[] | null;
  page_start?: number | null;
  is_favorite: boolean;
  entry_date: string;
  created_at: string;
  updated_at: string;
  media?: JournalEntryMediaItem[];
}

export interface SeriesJournalEntryRecord {
  id: string;
  public_id?: string;
  user_id: string;
  series_id: string;
  parent_entry_id?: string | null;
  label: JournalEntryLabel;
  attribution?: string | null;
  content: string;
  tags?: string[] | null;
  page_start?: number | null;
  is_favorite: boolean;
  entry_date: string;
  created_at: string;
  updated_at: string;
  media?: JournalEntryMediaItem[];
}

export interface AuthorJournalEntryRecord {
  id: string;
  public_id?: string;
  user_id: string;
  author_id: string;
  parent_entry_id?: string | null;
  label: JournalEntryLabel;
  attribution?: string | null;
  content: string;
  tags?: string[] | null;
  page_start?: number | null;
  is_favorite: boolean;
  entry_date: string;
  created_at: string;
  updated_at: string;
  media?: JournalEntryMediaItem[];
}

export type JournalEntityType = "Book" | "Series" | "Author";

export type JournalEntryType =
  | "note"
  | "thought"
  | "passage"
  | "review"
  | "started_reading"
  | "finished_reading"
  | "rating_added"
  | "reading_progress_milestone"
  | "reading_session";

export type JournalEntrySource =
  | "book_note"
  | "series_note"
  | "author_note"
  | "generated_book_event";

export type ManualJournalEntrySource = Exclude<JournalEntrySource, "generated_book_event">;

export interface MediaAttachment {
  id: string;
  user_id: string;
  file_path: string;
  thumbnail_path?: string | null;
  file_name: string;
  file_type: "image/jpeg" | "image/png" | "image/webp";
  file_size: number;
  width?: number | null;
  height?: number | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryMedia {
  id: string;
  journal_entry_source: ManualJournalEntrySource;
  journal_entry_id: string;
  media_attachment_id: string;
  position: number;
  caption?: string | null;
  created_at: string;
}

export interface JournalEntryMediaItem extends JournalEntryMedia {
  media_attachment: MediaAttachment;
  url: string;
  thumbnailUrl?: string | null;
}

export interface JournalEntry {
  id: string;
  entityType: JournalEntityType;
  entityId: string;
  type: JournalEntryType;
  source: JournalEntrySource;
  sourceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryVisibility {
  id: string;
  user_id: string;
  entity_type: JournalEntityType;
  entity_id: string;
  source: JournalEntrySource;
  source_id: string;
  hidden_at: string;
  created_at: string;
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

export interface JournalFilterDefaults {
  show_quotes: boolean;
  show_thoughts: boolean;
  show_automatic: boolean;
  show_from_books: boolean;
}

export interface ReadingSettings {
  default_reading_status: BookStatus;
  reading_pace_calculation: ReadingPaceCalculation;
  progress_display: ProgressDisplay;
  reading_streak_enabled: boolean;
  reading_streak_goal_days: number;
  auto_finish_books: boolean;
  estimated_completion_dates: boolean;
  journal_filter_defaults: JournalFilterDefaults;
}

export type LibrarySorting = "recently_added" | "title" | "author" | "rating" | "status";

export type LibraryView = "grid" | "list";

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
  chat_notifications: boolean;
  goal_completion_notifications: boolean;
  friend_activity_notifications: boolean;
  new_follower_notifications: boolean;
}

export interface PrivacySettings {
  private_account: boolean;
  show_reading_activity: boolean;
  show_reading_statistics_publicly: boolean;
  show_reading_goals_publicly: boolean;
  chat_save_receipts: boolean;
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
  last_seen_release_note_version: string | null;
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
  kind: GroupKind;
  direct_pair_key?: string | null;
  created_at: string;
}

export type GroupKind = "direct" | "group";

export type GroupMembershipRole = "owner" | "admin" | "member";

export type GroupMembershipStatus = "active" | "invited";

export interface GroupMembership {
  group_id: string;
  user_id: string;
  role: GroupMembershipRole;
  status: GroupMembershipStatus;
  last_read_at?: string | null;
  joined_at: string;
}

export type PublicProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "bio" | "created_at"
>;

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  attachment_type?: ChatAttachmentType | null;
  attachment_payload?: ChatAttachmentPayload | null;
  reply_to_message_id?: string | null;
  reply_snapshot?: ChatReplySnapshot | null;
  created_at: string;
  updated_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
}

export interface ChatMessageNotification {
  id: string;
  recipient_id: string;
  group_id: string;
  message_id: string;
  sender_id: string;
  sender_name: string;
  message_preview: string;
  created_at: string;
  read_at: string | null;
}

export interface ChatReplySnapshot {
  message_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  attachment_type?: ChatAttachmentType | null;
  attachment_title?: string | null;
  created_at: string;
}

// Chat attachments use a stable snapshot shape so sent messages don't change
// if the underlying book, note, author, or series data changes later.
export type ChatAttachmentType = "book" | "note" | "author" | "series";

export type ChatSharedNoteLabel = JournalEntryLabel;

export interface ChatSharedNoteSnapshot {
  id?: string;
  label: ChatSharedNoteLabel;
  content: string;
  attribution?: string | null;
  page_start?: number | null;
  entry_date?: string | null;
  book_id?: string | null;
  book_title?: string | null;
  book_authors?: string[];
  tags?: string[] | null;
  source_type?: "book" | "series" | "author";
  source_id?: string | null;
  source_title?: string | null;
  source_authors?: string[];
  source_image_url?: string | null;
}

export interface ChatSharedBookSnapshot {
  id?: string;
  title: string;
  authors: string[];
  cover_url?: string | null;
  genres?: string[];
  total_pages?: number | null;
  language?: BookLanguage | null;
  format?: BookFormat | null;
  isbn?: string | null;
  publication_date?: string | null;
  description?: string | null;
  metadata_source?: BookMetadataSource | null;
  metadata_source_url?: string | null;
  volume_number?: number | null;
  // The author names remain the source of truth for a book. These optional
  // snapshots let recipients copy author photos into their own library.
  author_profiles?: Array<{
    name: string;
    photo_url?: string | null;
  }>;
  included_journalEntries?: ChatSharedNoteSnapshot[];
}

export interface ChatBookAttachment {
  type: "book";
  book: ChatSharedBookSnapshot;
}

export interface ChatNoteAttachment {
  type: "note";
  note: ChatSharedNoteSnapshot;
  book?: ChatSharedBookSnapshot | null;
}

export interface ChatAuthorAttachment {
  type: "author";
  author: {
    id?: string;
    name: string;
    photo_url?: string | null;
    bio?: string | null;
    books: ChatSharedBookSnapshot[];
    included_quotes?: ChatSharedNoteSnapshot[];
  };
}

export interface ChatSharedSeriesSnapshot {
  id?: string;
  name: string;
  cover_url?: string | null;
  authors?: string[];
  description?: string | null;
  books: ChatSharedBookSnapshot[];
  included_quotes?: ChatSharedNoteSnapshot[];
}

export interface ChatSeriesAttachment {
  type: "series";
  series: ChatSharedSeriesSnapshot;
}

export type ChatAttachmentPayload =
  | ChatBookAttachment
  | ChatNoteAttachment
  | ChatAuthorAttachment
  | ChatSeriesAttachment;
