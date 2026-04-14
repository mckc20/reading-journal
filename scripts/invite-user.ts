/**
 * Invite a user to the Reading Journal by email.
 *
 * Uses the Supabase Admin API with the service role key — this script must
 * NEVER be imported by any file under src/. The service role key bypasses RLS.
 *
 * Usage:
 *   npm run invite user@example.com
 *
 * Prerequisites:
 *   - VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env
 *   - Public sign-ups must be disabled in Supabase Auth settings
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inviteRedirectUrl = process.env.INVITE_REDIRECT_URL;

if (!supabaseUrl || !serviceRoleKey || !inviteRedirectUrl) {
  console.error(
    "Missing env vars. Ensure VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and INVITE_REDIRECT_URL are set in .env",
  );
  process.exit(1);
}

// This client uses the service role key and bypasses RLS.
// Never instantiate this pattern inside src/.
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run invite <email>");
  process.exit(1);
}

const redirectTo = `${inviteRedirectUrl}/login`;

const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });

if (error) {
  console.error("Invite failed:", error.message);
  process.exit(1);
}

console.log(`Invite sent to ${data.user.email} (id: ${data.user.id})`);
