import { RouterProvider } from "react-router-dom";
import { AuthProvider, ThemeProvider, UserSettingsProvider } from "@/context";
import BookFinishedCelebration from "@/components/BookFinishedCelebration";
import { router } from "@/lib/router";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <RouterProvider router={router} />
          <BookFinishedCelebration />
        </UserSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
