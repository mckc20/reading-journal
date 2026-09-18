import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context";
import { supabase } from "@/lib/supabase";

interface ResetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

export default function ResetPassword() {
  const { loading, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState, setError, getValues } =
    useForm<ResetPasswordFormValues>();

  const onSubmit = async ({ password }: ResetPasswordFormValues) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("root", { message: error.message });
      return;
    }

    setSuccess(true);
  };

  const continueToSignIn = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-foreground">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-background border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="login-fallback flex min-h-svh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border/70 bg-background/95 p-6 shadow-[var(--shadow-popover)] backdrop-blur-md sm:p-7">
        <div className="space-y-1">
          <AppHeading level={1} as="h1" className="tracking-tight">Reading Journal</AppHeading>
          <HeadingDescription>Choose a new password</HeadingDescription>
        </div>

        {!session ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full"
            >
              Back to sign in
            </Button>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your password has been updated successfully.
            </p>
            <Button type="button" onClick={continueToSignIn} className="w-full">
              Continue to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Password must be at least 8 characters" },
                })}
              />
              {formState.errors.password && (
                <p className="text-sm text-destructive">{formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (value) => value === getValues("password") || "Passwords do not match",
                })}
              />
              {formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{formState.errors.confirmPassword.message}</p>
              )}
            </div>
            {formState.errors.root && (
              <p className="text-sm text-destructive">{formState.errors.root.message}</p>
            )}
            <Button type="submit" disabled={formState.isSubmitting} className="w-full">
              {formState.isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
