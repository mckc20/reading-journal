import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/context";
import { router } from "@/lib/router";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
