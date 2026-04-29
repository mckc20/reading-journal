import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Bell, Check, ChevronLeft, ChevronRight, KeyRound, Monitor, Shield, UserRound } from "lucide-react";
import SetPasswordDialog from "@/components/SetPasswordDialog";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile, useTheme, type Theme } from "@/context";
import { getErrorMessage } from "@/lib/profiles";
import { cleanProfilePayload, emptyProfileForm, profileToForm, type ProfileForm as ProfileFormValues } from "@/lib/profileForm";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "account" | "notification" | "appearance";

const settingsTabs: Array<{
  value: SettingsTab;
  label: string;
  icon: typeof UserRound;
}> = [
  { value: "profile", label: "Profile", icon: UserRound },
  { value: "account", label: "Account", icon: Shield },
  { value: "notification", label: "Notification", icon: Bell },
  { value: "appearance", label: "Appearance", icon: Monitor },
];

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return settingsTabs.some((tab) => tab.value === value);
}

function ProfileSettings() {
  const { profile, loading, error: profileError, saveProfile } = useProfile();
  const [form, setForm] = useState<ProfileFormValues>(emptyProfileForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(profileToForm(profile));
  }, [profile]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const savedProfile = await saveProfile(cleanProfilePayload(form));
      setForm(profileToForm(savedProfile));
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Could not save profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {profileError && <p className="text-sm text-destructive">{profileError}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <ProfileForm
            form={form}
            disabled={loading}
            saving={saving}
            onSubmit={submitProfile}
            onChange={setForm}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AccountSettings() {
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => setPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Set password
          </Button>
        </CardContent>
      </Card>
      <SetPasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </>
  );
}

function NotificationSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Notification settings will be added here.</p>
      </CardContent>
    </Card>
  );
}

const themeOptions: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const active = option.value === theme;

            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? "default" : "outline"}
                onClick={() => setTheme(option.value)}
                aria-pressed={active}
                className="justify-start"
              >
                {active && <Check className="mr-2 h-4 w-4" />}
                {!active && <span className="mr-2 h-4 w-4" aria-hidden="true" />}
                {option.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTabContent({ tab }: { tab: SettingsTab }) {
  if (tab === "profile") return <ProfileSettings />;
  if (tab === "account") return <AccountSettings />;
  if (tab === "notification") return <NotificationSettings />;
  return <AppearanceSettings />;
}

function SettingsList({ activeTab }: { activeTab?: SettingsTab }) {
  return (
    <nav className="space-y-1">
      {settingsTabs.map(({ value, label, icon: Icon }) => {
        const active = value === activeTab;

        return (
          <Link
            key={value}
            to={`/settings/${value}`}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="min-w-0 flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 md:hidden" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}

export default function Settings() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = isSettingsTab(tab) ? tab : undefined;

  useEffect(() => {
    if (tab) return;
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    if (desktopQuery.matches) {
      navigate("/settings/profile", { replace: true });
    }
  }, [navigate, tab]);

  if (tab && !activeTab) {
    return <Navigate to="/settings/profile" replace />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <h1 className="text-2xl font-heading leading-snug font-medium">Settings</h1>
      </div>

      <div className="md:hidden">
        {!activeTab ? (
          <h1 className="text-2xl font-heading leading-snug font-medium">Settings</h1>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/settings">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className={cn(activeTab && "hidden md:block")}>
          <SettingsList activeTab={activeTab} />
        </aside>

        <section className={cn(!activeTab && "hidden md:block")}>
          {activeTab && <SettingsTabContent tab={activeTab} />}
        </section>
      </div>
    </div>
  );
}
