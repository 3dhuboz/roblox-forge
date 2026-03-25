import { Routes, Route } from "react-router-dom";
import { DevModeBanner } from "./components/DevModeBanner";
import { Layout } from "./components/Layout";
import { TemplateSelector } from "./features/templates/TemplateSelector";
import { BuildPage } from "./features/build/BuildPage";
import { PublishPage } from "./features/publish/PublishPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow";
import { useUserStore } from "./stores/userStore";

function App() {
  const { profile } = useUserStore();

  const shell = (body: React.ReactNode) => (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      <DevModeBanner />
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );

  if (!profile.hasCompletedOnboarding) {
    return shell(<OnboardingFlow />);
  }

  return shell(
    <Layout>
      <Routes>
        <Route path="/" element={<TemplateSelector />} />
        <Route path="/build" element={<BuildPage />} />
        <Route path="/publish" element={<PublishPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>,
  );
}

export default App;
