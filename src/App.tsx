import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { client } from "./lib/api";
import { Shell } from "./components/shell";
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { UploadPage } from "./pages/upload";
import { EditorPage } from "./pages/editor";
import { GeneratedPage } from "./pages/generated";
import { SettingsPage } from "./pages/settings";
import { MastersPage } from "./pages/masters";

function Gate() {
  const me = useQuery({ queryKey: ["me"], queryFn: client.me });
  if (me.isLoading) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        Loading Document Studio…
      </div>
    );
  }
  if (me.isError || !me.data) return <Navigate to="/login" replace />;
  return <Shell user={me.data.user} />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Gate />}>
        <Route path="/" element={<Navigate to="/document-studio" replace />} />
        <Route path="/document-studio" element={<DashboardPage />} />
        <Route path="/document-studio/masters" element={<MastersPage />} />
        <Route path="/document-studio/upload" element={<UploadPage />} />
        <Route path="/document-studio/templates/:id" element={<EditorPage />} />
        <Route path="/document-studio/generated" element={<GeneratedPage />} />
        <Route path="/document-studio/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/document-studio" replace />} />
    </Routes>
  );
}
