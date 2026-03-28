import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { DevModeBanner } from "./components/DevModeBanner";
import { Layout } from "./components/Layout";
import { TemplateSelector } from "./features/templates/TemplateSelector";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow";
import { useUserStore } from "./stores/userStore";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts";
import { ToastContainer } from "./components/ToastContainer";

const BuildPage = lazy(() =>
  import("./features/build/BuildPage").then((m) => ({ default: m.BuildPage })),
);
const PublishPage = lazy(() =>
  import("./features/publish/PublishPage").then((m) => ({ default: m.PublishPage })),
);
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);

function App() {
  const { profile } = useUserStore();
  useKeyboardShortcuts();

  const shell = (body: React.ReactNode) => (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      <DevModeBanner />
      <div className="min-h-0 flex-1">{body}</div>
      <ToastContainer />
    </div>
  );

  if (!profile.hasCompletedOnboarding) {
    return shell(<OnboardingFlow />);
  }

  return shell(
    <Layout>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<TemplateSelector />} />
          <Route path="/build" element={<BuildPage />} />
          <Route path="/publish" element={<PublishPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
    </Layout>,
  );
}

export default App;
