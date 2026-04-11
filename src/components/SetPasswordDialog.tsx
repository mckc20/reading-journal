import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

interface SetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

interface SetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SetPasswordDialog({ open, onOpenChange }: SetPasswordDialogProps) {
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, formState, setError, reset, getValues } =
    useForm<SetPasswordFormValues>();

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
      setSuccess(false);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: SetPasswordFormValues) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setError("root", { message: error.message });
    } else {
      setSuccess(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Password updated successfully. You can now sign in with your new password.
            </p>
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
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (value) =>
                    value === getValues("password") || "Passwords do not match",
                })}
              />
              {formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {formState.errors.root && (
              <p className="text-sm text-destructive">{formState.errors.root.message}</p>
            )}

            <DialogFooter>
              <Button type="submit" disabled={formState.isSubmitting} className="w-full">
                {formState.isSubmitting ? "Updating…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
