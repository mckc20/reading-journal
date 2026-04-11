import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginFormValues {
  email: string;
  password: string;
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState, setError } = useForm<LoginFormValues>();

  // Already authenticated — redirect away from login
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  const onSubmit = async (values: LoginFormValues) => {
    const { error } = await signIn(values.email, values.password);
    if (error) {
      setError("root", { message: error.message });
      return;
    }
    // Redirect back to the page the user was trying to reach, or home
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  };

  return (
    <main className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Reading Journal</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email", { required: "Email is required" })}
            />
            {formState.errors.email && (
              <p className="text-sm text-destructive">{formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password", { required: "Password is required" })}
            />
            {formState.errors.password && (
              <p className="text-sm text-destructive">{formState.errors.password.message}</p>
            )}
          </div>
          {formState.errors.root && (
            <p className="text-sm text-destructive">{formState.errors.root.message}</p>
          )}
          <Button type="submit" disabled={formState.isSubmitting} className="w-full">
            {formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
