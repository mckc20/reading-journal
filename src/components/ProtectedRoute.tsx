import LoadingIndicator from "@/components/LoadingIndicator";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Auth state not yet resolved — show neutral loading screen.
  // Must not redirect here; the user may well be authenticated.
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <LoadingIndicator variant="page" label="Loading your session…" />
      </div>
    );
  }

  if (!user) {
    // Save the intended destination so Login can redirect back after sign-in
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
