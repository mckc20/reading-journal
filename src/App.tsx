import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserSettingsProvider } from "@/context/UserSettingsContext";
import { router } from "@/lib/router";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <RouterProvider router={router} />
        </UserSettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
