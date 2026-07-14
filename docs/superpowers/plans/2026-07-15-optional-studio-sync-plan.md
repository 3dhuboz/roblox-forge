# Optional Studio Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Rojo from normal RobloxForge readiness while preserving it as an explicitly opened, optional Desktop-only live-sync tool for advanced users.

**Architecture:** `TemplateSelector` owns only the two beginner setup requirements: an authoritative Desktop AI-provider check and an existing project. `SettingsPage` owns the optional Rojo integration behind a collapsed disclosure. Opening the disclosure is the sole trigger for a Rojo status probe; attempt IDs, runtime checks, and in-flight guards prevent stale status or action results from appearing after collapse, runtime loss, unmount, or a newer action. The Build, Publish, Roblox Open Cloud, analytics, and Rust/Tauri authority paths remain unchanged.

**Tech Stack:** React 19, TypeScript, Zustand, Tauri 2, Vitest, Testing Library, Vite, Rust/Cargo, Windows NSIS/MSI packaging.

---

## Behavior contract

| Surface | Default behavior | Optional behavior |
| --- | --- | --- |
| Getting Started | AI provider plus first project; `0/2` through `2/2` | No Rojo UI or command |
| Settings in browser | Collapsed `Advanced Studio Sync` with `Optional` badge | Expansion shows a neutral Desktop explanation and makes zero Rojo calls |
| Settings in Desktop | Collapsed and makes zero Rojo calls | First expansion makes one status call; installed users retain refresh/start/stop |
| Missing Rojo | Never blocks setup, build, publish, or analytics | Neutral information appears only after deliberate expansion |
| Publish | Verified existing-place authority only | Never reads Rojo state |

## File map

- Modify: `src/features/templates/TemplateSelector.tsx`
- Modify: `src/features/templates/TemplateSelector.setupChecklist.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.authority.test.tsx`
- Verify unchanged: `src/features/build/BuildPage.export.test.tsx`
- Verify unchanged: `src/features/publish/PublishPage.robloxAuthority.test.tsx`
- Verify unchanged: `src/features/settings/SettingsPage.robloxAuthority.test.tsx`
- Verify unchanged: `src-tauri/src/roblox_authority/**`

### Task 1: Make beginner onboarding independent of Rojo

**Files:**
- Modify: `src/features/templates/TemplateSelector.setupChecklist.test.tsx`
- Modify: `src/features/templates/TemplateSelector.tsx`

- [ ] **Step 1: Replace the Rojo-gated setup tests with the two-item contract**

Keep the existing runtime, store, local-storage, and deferred-promise helpers. Remove `RojoStatus`, `installedRojo`, and `missingRojo` fixtures. Keep the `rojoCommands.checkStatus` spy only as a tripwire proving it is never called. The describe block must cover these exact cases:

```tsx
it("keeps a persisted API flag incomplete while the authoritative key check is pending", async () => {
  enableTauriRuntime();
  seedProfile(true);
  seedRecentProject();
  const keyCheck = deferred<string | null>();
  vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);

  renderSelector();

  expect(await screen.findByText("1/2")).toBeInTheDocument();
  expect(screen.getByText("Set up your AI key")).not.toHaveClass("line-through");
  expect(screen.getByText(/Checking AI key/i)).toBeInTheDocument();
  expect(screen.queryByText(/Install Rojo/i)).not.toBeInTheDocument();
  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();

  await act(async () => {
    keyCheck.resolve(null);
    await keyCheck.promise;
  });

  expect(screen.getByText("1/2")).toBeInTheDocument();
  expect(screen.getByText(/No AI key is configured/i)).toBeInTheDocument();
});

it("completes after an authoritative provider check and an existing project without checking Rojo", async () => {
  enableTauriRuntime();
  seedRecentProject();
  vi.mocked(aiCommands.checkApiKey).mockResolvedValueOnce("openrouter");

  renderSelector();

  await waitFor(() =>
    expect(screen.queryByText("Getting Started")).not.toBeInTheDocument(),
  );
  expect(useUserStore.getState().profile.hasSetApiKey).toBe(true);
  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
});

it("shows only the AI Desktop requirement in browser and calls no Desktop checks", () => {
  seedProfile(true);
  seedRecentProject();

  renderSelector();

  expect(screen.getByText("1/2")).toBeInTheDocument();
  expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(1);
  expect(screen.queryByText(/Install Rojo/i)).not.toBeInTheDocument();
  expect(aiCommands.checkApiKey).not.toHaveBeenCalled();
  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
});
```

Retain the existing AI typed-error, runtime-loss, late-rejection, and unmount coverage, but make each test operate only on `aiCommands.checkApiKey`. Their progress assertion is `1/2`, their Desktop-required hint count is one, and each test ends with `expect(rojoCommands.checkStatus).not.toHaveBeenCalled()`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:run -- src/features/templates/TemplateSelector.setupChecklist.test.tsx
```

Expected: FAIL because the current component renders `Install Rojo`, displays `/3`, and calls `rojoCommands.checkStatus()` in Desktop mode.

- [ ] **Step 3: Remove Rojo from `SetupChecklist`**

Make these exact structural changes in `TemplateSelector.tsx`:

```tsx
import {
  Mountain,
  Factory,
  Zap,
  Swords,
  Map,
  Ghost,
  Car,
  Dice1,
  Clock,
  Trash2,
  CheckCircle,
  Circle,
  Key,
  Gamepad2,
  X,
  ChevronRight,
} from "lucide-react";
import {
  aiCommands,
  isOperationUnavailableError,
} from "../../services/tauriCommands";
```

Delete `RojoChecklistStatus`, `RojoChecklistState`, `unavailableRojoChecklistState`, `rojoState`, and the complete `rojoCommands.checkStatus()` promise chain. The final readiness calculation and item array are:

```tsx
const apiKeyDone = apiState.status === "configured";
const projectDone = hasProjects;
const allDone = apiKeyDone && projectDone;

if (allDone) return null;

const items = [
  {
    done: apiKeyDone,
    icon: Key,
    label: "Set up your AI key",
    hint: apiState.hint,
    attention:
      apiState.status === "unavailable" || apiState.status === "error",
    action: () => navigate("/settings"),
    actionLabel: "Settings",
  },
  {
    done: projectDone,
    icon: Gamepad2,
    label: "Create your first game",
    hint: "Pick a template below to get started",
    attention: false,
    action: null,
    actionLabel: null,
  },
];
```

Render `{doneCount}/2` in the progress badge. Do not add any persisted Rojo readiness state.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:run -- src/features/templates/TemplateSelector.setupChecklist.test.tsx
```

Expected: all setup-checklist tests PASS and every Rojo call assertion remains zero.

- [ ] **Step 5: Commit the onboarding slice**

```powershell
git add src/features/templates/TemplateSelector.tsx src/features/templates/TemplateSelector.setupChecklist.test.tsx
git commit -m "fix: remove Rojo from beginner setup"
```

### Task 2: Add the collapsed optional Studio Sync surface

**Files:**
- Modify: `src/features/settings/SettingsPage.authority.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: Add disclosure and lazy-probe tests**

Add this helper to `SettingsPage.authority.test.tsx`:

```tsx
function expandStudioSync(): void {
  fireEvent.click(
    screen.getByRole("button", { name: "Show Advanced Studio Sync" }),
  );
}
```

Replace the eager browser expectation and add the Desktop cases below:

```tsx
it("keeps Advanced Studio Sync optional and collapsed in browser without probing Rojo", () => {
  render(<SettingsPage />);

  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });
  expect(within(panel).getByText("Optional")).toBeInTheDocument();
  expect(within(panel).getByRole("button", { name: "Show Advanced Studio Sync" }))
    .toHaveAttribute("aria-expanded", "false");
  expect(within(panel).getByText(/Not needed to create, preview, publish, or monitor/i))
    .toBeInTheDocument();
  expect(within(panel).queryByText(/Desktop app/i)).not.toBeInTheDocument();
  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
});

it("explains browser limitations neutrally after expansion without probing Rojo", () => {
  render(<SettingsPage />);
  expandStudioSync();

  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });
  expect(within(panel).getByRole("status")).toHaveTextContent(
    /Advanced Studio Sync can only be managed in RobloxForge Desktop/i,
  );
  expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
});

it("waits for Desktop expansion before checking Rojo exactly once", async () => {
  enableTauriRuntime();
  vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
  render(<SettingsPage />);

  expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  expandStudioSync();

  expect(await screen.findByText("Rojo Installed")).toBeInTheDocument();
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
});

it("renders missing Rojo as optional information rather than an alert", async () => {
  enableTauriRuntime();
  render(<SettingsPage />);
  expandStudioSync();

  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });
  expect(await within(panel).findByRole("status")).toHaveTextContent(
    /Rojo is not installed. That is fine unless you choose live Studio sync/i,
  );
  expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
});
```

Add `within` to the Testing Library import. Existing start, stop, refresh, typed-error, runtime-loss, and stale-result tests must call `expandStudioSync()` before waiting for Rojo controls. Do not loosen their call-count or error-redaction assertions.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:run -- src/features/settings/SettingsPage.authority.test.tsx
```

Expected: FAIL because the current card is always open, is named `Rojo Sync`, probes on mount, and renders missing/runtime-unavailable states as alerts.

- [ ] **Step 3: Introduce an idle authority state and explicit expansion**

Change the Rojo authority type and initialize it without probing:

```tsx
const ROJO_DESKTOP_REQUIRED =
  "Advanced Studio Sync can only be managed in RobloxForge Desktop.";

type RojoAuthorityStatus =
  | "idle"
  | "checking"
  | "ready"
  | "unavailable"
  | "error";

function idleRojoAuthorityState(): RojoAuthorityState {
  return {
    status: "idle",
    message: null,
    recoveryAction: null,
  };
}

const [studioSyncExpanded, setStudioSyncExpanded] = useState(false);
const [rojoStatus, setRojoStatus] = useState<RojoStatus | null>(null);
const [rojoLoading, setRojoLoading] = useState(false);
const [rojoAuthority, setRojoAuthority] = useState<RojoAuthorityState>(
  idleRojoAuthorityState,
);
```

Remove `void refreshRojoStatus()` and `refreshRojoStatus` from the main mount/AI-check effect. Guard the status probe and action runner with `!studioSyncExpanded`, and set the checking state immediately before the status call:

```tsx
if (
  !studioSyncExpanded ||
  !desktopRuntime ||
  !isTauriRuntime() ||
  !mountedRef.current ||
  rojoInFlightRef.current
) {
  return;
}

rojoInFlightRef.current = true;
const attemptId = ++rojoAttemptIdRef.current;
setRojoLoading(true);
setRojoStatus(null);
setRojoAuthority({
  status: "checking",
  message: null,
  recoveryAction: null,
});
```

Include `studioSyncExpanded` in both callback dependency arrays. Add a separate expansion effect after the mount effect. Task 3 will add synchronous invalidation when the panel closes; keep that concurrency work out of this first disclosure slice so its regression test is genuinely RED.

```tsx
useEffect(() => {
  if (!studioSyncExpanded) return;

  if (!desktopRuntime || !isTauriRuntime()) {
    showRojoRuntimeUnavailable();
    return;
  }

  void refreshRojoStatus();
}, [
  desktopRuntime,
  refreshRojoStatus,
  showRojoRuntimeUnavailable,
  studioSyncExpanded,
]);
```

`showRojoRuntimeUnavailable()` must clear `rojoStatus` and `rojoLoading` before setting the unavailable state. This keeps browser/runtime-loss output authoritative and prevents an old installed status from remaining visible.

- [ ] **Step 4: Replace the eager warning card with the accessible disclosure**

Use a named region and a disclosure button. The heading copy is exact:

```tsx
<section
  aria-labelledby="advanced-studio-sync-title"
  className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6"
>
  <div className="flex items-start justify-between gap-4">
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Radio size={20} className="text-indigo-400" />
        <h3 id="advanced-studio-sync-title" className="text-[15px] font-bold text-white">
          Advanced Studio Sync
        </h3>
        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-300">
          Optional
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-[13px] text-gray-400">
        Not needed to create, preview, publish, or monitor your game. Open this only if you want live synchronization with Roblox Studio.
      </p>
    </div>
    <button
      type="button"
      aria-expanded={studioSyncExpanded}
      aria-controls="advanced-studio-sync-content"
      aria-label={`${studioSyncExpanded ? "Hide" : "Show"} Advanced Studio Sync`}
      onClick={() => setStudioSyncExpanded((expanded) => !expanded)}
      className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-800"
    >
      {studioSyncExpanded ? "Close" : "Open"}
    </button>
  </div>

  {studioSyncExpanded && (
    <div id="advanced-studio-sync-content" className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex justify-end">
        <button
          type="button"
          aria-label="Refresh Rojo status"
          onClick={refreshRojoStatus}
          disabled={
            !desktopRuntime ||
            !isTauriRuntime() ||
            rojoLoading ||
            rojoAuthority.status === "unavailable"
          }
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw
            size={14}
            className={rojoLoading ? "animate-spin" : undefined}
          />
        </button>
      </div>

      {!desktopRuntime || rojoAuthority.status === "unavailable" ? (
        <div
          className="mt-3 rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 text-[13px] text-gray-300"
          role="status"
        >
          Advanced Studio Sync can only be managed in RobloxForge Desktop.
        </div>
      ) : rojoAuthority.status === "error" ? (
        <div
          className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-[13px] text-red-300"
          role="alert"
        >
          <p>{rojoAuthority.message}</p>
          {rojoAuthority.recoveryAction && (
            <p className="mt-1 text-red-200">
              {rojoAuthority.recoveryAction}
            </p>
          )}
        </div>
      ) : rojoAuthority.status === "ready" && rojoStatus ? (
        <div className="mt-3 space-y-3">
          {rojoStatus.installed ? (
            <>
              <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-gray-200">
                    Rojo Installed
                  </p>
                  <p className="text-xs text-gray-500">
                    {rojoStatus.version ?? "Yes"}
                  </p>
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-gray-200">
                    {rojoStatus.serving ? "Serving" : "Not serving"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {rojoStatus.serving
                      ? `Port ${rojoStatus.serve_port ?? "34872"} - open Studio with the Rojo plugin`
                      : "Start only when you want live Studio synchronization"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={rojoStatus.serving ? handleStopServe : handleStartServe}
                  disabled={rojoLoading}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold ${
                    rojoStatus.serving
                      ? "bg-red-950/30 text-red-300 hover:bg-red-950/50"
                      : "bg-indigo-600 text-white hover:bg-indigo-500"
                  } disabled:opacity-50`}
                >
                  {rojoLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : rojoStatus.serving ? (
                    <Square size={14} />
                  ) : (
                    <Play size={14} />
                  )}
                  {rojoStatus.serving ? "Stop" : "Start Sync to Studio"}
                </button>
              </div>
            </>
          ) : (
            <div
              className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-4 py-3 text-[13px] text-gray-300"
              role="status"
            >
              <p>
                Rojo is not installed. That is fine unless you choose live Studio sync.
              </p>
              {rojoStatus.install_instructions && (
                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-500">
                  {rojoStatus.install_instructions}
                </pre>
              )}
            </div>
          )}
        </div>
      ) : rojoAuthority.status === "checking" ? (
        <div
          className="mt-4 flex items-center gap-2 text-[13px] text-gray-500"
          role="status"
        >
          <Loader2 size={14} className="animate-spin" /> Checking Rojo...
        </div>
      ) : null}
    </div>
  )}
</section>
```

Inside the expanded content:

- Browser `unavailable`: render `role="status"` with `Advanced Studio Sync can only be managed in RobloxForge Desktop.` and no command or install instructions.
- Explicit command failure `error`: retain the red `role="alert"` and recovery action.
- `ready` plus installed: retain version, serving state, Refresh, Start Sync to Studio, and Stop controls.
- `ready` plus missing: render `role="status"` with `Rojo is not installed. That is fine unless you choose live Studio sync.` followed by the returned installation instructions. Use neutral gray/indigo styling and no warning icon.
- `checking`: retain the loading status.
- `idle`: render nothing; in Desktop the expansion effect immediately promotes it to checking.

Move the Refresh control into expanded content. Disable it only while loading or when Desktop authority is unavailable. Remove `AlertTriangle` from imports if no other use remains.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:run -- src/features/settings/SettingsPage.authority.test.tsx
```

Expected: all Settings authority tests PASS; collapsed/browser call count is zero and first Desktop expansion call count is one.

- [ ] **Step 6: Commit the optional Settings surface**

```powershell
git add src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.authority.test.tsx
git commit -m "feat: make Studio sync an optional advanced tool"
```

### Task 3: Prove collapse, runtime, and action concurrency safety

**Files:**
- Modify: `src/features/settings/SettingsPage.authority.test.tsx`
- Modify only if a failing test requires it: `src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: Add the stale-collapse regression test**

```tsx
it("keeps a newer expansion authoritative when an older Rojo probe resolves late", async () => {
  enableTauriRuntime();
  const oldStatusCheck = deferred<RojoStatus>();
  vi.mocked(rojoCommands.checkStatus)
    .mockReturnValueOnce(oldStatusCheck.promise)
    .mockResolvedValueOnce(missingRojo);
  render(<SettingsPage />);
  expandStudioSync();

  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: "Hide Advanced Studio Sync" }),
  );
  expandStudioSync();
  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });

  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);

  await act(async () => {
    oldStatusCheck.resolve(installedRojo);
    await oldStatusCheck.promise;
  });

  await waitFor(() =>
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2),
  );
  expect(await within(panel).findByRole("status")).toHaveTextContent(
    /Rojo is not installed/i,
  );

  expect(screen.queryByText("Rojo Installed")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hide Advanced Studio Sync" }))
    .toHaveAttribute("aria-expanded", "true");
  expect(within(panel).getByRole("status")).toHaveTextContent(/Rojo is not installed/i);
});

it("keeps the mutation lock while Start Sync is pending across collapse and reopen", async () => {
  enableTauriRuntime();
  const start = deferred<number>();
  vi.mocked(rojoCommands.checkStatus)
    .mockResolvedValueOnce(installedRojo)
    .mockResolvedValueOnce(installedRojo);
  vi.mocked(rojoCommands.startServe).mockReturnValueOnce(start.promise);
  render(<SettingsPage />);
  expandStudioSync();

  const startButton = await screen.findByRole("button", {
    name: "Start Sync to Studio",
  });
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
  fireEvent.click(startButton);
  fireEvent.click(
    screen.getByRole("button", { name: "Hide Advanced Studio Sync" }),
  );
  expandStudioSync();

  expect(
    screen.queryByRole("button", { name: "Start Sync to Studio" }),
  ).not.toBeInTheDocument();
  expect(rojoCommands.startServe).toHaveBeenCalledTimes(1);
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);

  await act(async () => {
    start.resolve(34872);
    await start.promise;
  });

  await waitFor(() =>
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2),
  );
  expect(
    await screen.findByRole("button", { name: "Start Sync to Studio" }),
  ).toBeInTheDocument();
  expect(rojoCommands.startServe).toHaveBeenCalledTimes(1);
});

it("clears an installed status when runtime disappears before Refresh", async () => {
  enableTauriRuntime();
  vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
  render(<SettingsPage />);
  expandStudioSync();

  await screen.findByText("Rojo Installed");
  clearTauriRuntime();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh Rojo status" }),
  );

  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });
  expect(within(panel).getByRole("status")).toHaveTextContent(
    /Advanced Studio Sync can only be managed in RobloxForge Desktop/i,
  );
  expect(within(panel).queryByText("Rojo Installed")).not.toBeInTheDocument();
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
});

it("clears an installed status and skips Start when runtime disappears", async () => {
  enableTauriRuntime();
  vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
  render(<SettingsPage />);
  expandStudioSync();

  const startButton = await screen.findByRole("button", {
    name: "Start Sync to Studio",
  });
  clearTauriRuntime();
  fireEvent.click(startButton);

  const panel = screen.getByRole("region", { name: "Advanced Studio Sync" });
  expect(within(panel).getByRole("status")).toHaveTextContent(
    /Advanced Studio Sync can only be managed in RobloxForge Desktop/i,
  );
  expect(within(panel).queryByText("Rojo Installed")).not.toBeInTheDocument();
  expect(rojoCommands.startServe).not.toHaveBeenCalled();
});

it("keeps the disclosure state recoverable after runtime loss", async () => {
  enableTauriRuntime();
  vi.mocked(rojoCommands.checkStatus)
    .mockResolvedValueOnce(installedRojo)
    .mockResolvedValueOnce(installedRojo);
  render(<SettingsPage />);
  expandStudioSync();

  await screen.findByText("Rojo Installed");
  clearTauriRuntime();
  fireEvent.click(screen.getByRole("button", { name: "Refresh Rojo status" }));
  expect(screen.getByRole("button", { name: "Hide Advanced Studio Sync" }))
    .toHaveAttribute("aria-expanded", "true");

  enableTauriRuntime();
  fireEvent.click(
    screen.getByRole("button", { name: "Hide Advanced Studio Sync" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show Advanced Studio Sync" }),
  );

  expect(await screen.findByText("Rojo Installed")).toBeInTheDocument();
  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2);
});

it("allows only one immediate Start Sync action", async () => {
  enableTauriRuntime();
  const start = deferred<number>();
  vi.mocked(rojoCommands.checkStatus)
    .mockResolvedValueOnce(installedRojo)
    .mockResolvedValueOnce({
      ...installedRojo,
      serving: true,
      serve_port: 34872,
    });
  vi.mocked(rojoCommands.startServe).mockReturnValueOnce(start.promise);
  render(<SettingsPage />);
  expandStudioSync();

  const startButton = await screen.findByRole("button", {
    name: "Start Sync to Studio",
  });
  act(() => {
    startButton.click();
    startButton.click();
  });
  expect(rojoCommands.startServe).toHaveBeenCalledTimes(1);

  await act(async () => {
    start.resolve(34872);
    await start.promise;
  });
  expect(await screen.findByText("Serving")).toBeInTheDocument();
});

it("allows only one immediate Stop action", async () => {
  enableTauriRuntime();
  const stop = deferred<void>();
  vi.mocked(rojoCommands.checkStatus)
    .mockResolvedValueOnce({
      ...installedRojo,
      serving: true,
      serve_port: 34872,
    })
    .mockResolvedValueOnce(installedRojo);
  vi.mocked(rojoCommands.stopServe).mockReturnValueOnce(stop.promise);
  render(<SettingsPage />);
  expandStudioSync();

  const stopButton = await screen.findByRole("button", { name: "Stop" });
  act(() => {
    stopButton.click();
    stopButton.click();
  });
  expect(rojoCommands.stopServe).toHaveBeenCalledTimes(1);

  await act(async () => {
    stop.resolve();
    await stop.promise;
  });
  expect(await screen.findByText("Not serving")).toBeInTheDocument();
});

it("does not update or reconcile after an in-flight Rojo probe unmounts", async () => {
  enableTauriRuntime();
  const statusCheck = deferred<RojoStatus>();
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  vi.mocked(rojoCommands.checkStatus).mockReturnValueOnce(statusCheck.promise);
  const view = render(<SettingsPage />);
  expandStudioSync();

  view.unmount();
  await act(async () => {
    statusCheck.resolve(installedRojo);
    await statusCheck.promise;
  });

  expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
  expect(consoleError).not.toHaveBeenCalled();
});
```

Keep the existing action-rejection, refresh-rejection, and post-await runtime-loss cases in addition to these explicit guards.

- [ ] **Step 2: Run the stale/concurrency tests and verify RED**

Run:

```powershell
npm run test:run -- src/features/settings/SettingsPage.authority.test.tsx
```

Expected: FAIL because the first disclosure slice has no live expansion-generation ref, cannot reconcile after a locked operation settles across collapse/reopen, silently returns when the runtime disappears before a click, and lacks explicit Start/Stop lock and Rojo unmount proof.

- [ ] **Step 3: Separate presentation generation from operation ownership**

Replace the overloaded `rojoAttemptIdRef` and `rojoInFlightRef` with these refs and the reconciliation tick:

```tsx
const [rojoReconcileTick, setRojoReconcileTick] = useState(0);
const studioSyncExpandedRef = useRef(false);
const rojoGenerationRef = useRef(0);
const rojoOperationSequenceRef = useRef(0);
const rojoOperationOwnerRef = useRef<number | null>(null);

const handleStudioSyncToggle = useCallback(() => {
  const nextExpanded = !studioSyncExpandedRef.current;
  studioSyncExpandedRef.current = nextExpanded;

  if (!nextExpanded) {
    rojoGenerationRef.current += 1;
    setRojoLoading(false);
    setRojoStatus(null);
    setRojoAuthority(idleRojoAuthorityState());
  }

  setStudioSyncExpanded(nextExpanded);
}, []);
```

Collapse invalidates only presentation. It must **not** clear `rojoOperationOwnerRef`: a deferred status/start/stop operation still owns the mutation lock until its own `finally` block releases the matching operation ID.

Split lifecycle cleanup from the dependencyful AI authority effect. The component-lifetime effect runs once and owns `mountedRef`, generation invalidation, operation cleanup, and saved-timer cleanup; it must not depend on `desktopRuntime`, `studioSyncExpanded`, or any callback that changes when runtime state changes:

```tsx
useEffect(() => {
  mountedRef.current = true;
  return () => {
    mountedRef.current = false;
    apiAttemptIdRef.current += 1;
    rojoGenerationRef.current += 1;
    studioSyncExpandedRef.current = false;
    apiSaveInFlightRef.current = false;
    clearSavedTimer();
  };
}, [clearSavedTimer]);
```

The AI authority effect remains separate and may depend on `desktopRuntime`; runtime transitions must never set `studioSyncExpandedRef.current = false`. Add a small runtime transition effect that increments the Rojo generation and clears visible Rojo state when Desktop disappears, while leaving the disclosure open so a later runtime restoration can be tested and recovered:

```tsx
useEffect(() => {
  if (desktopRuntime && isTauriRuntime()) return;
  rojoGenerationRef.current += 1;
  setRojoLoading(false);
  setRojoStatus(null);
  setRojoAuthority(unavailableRojoAuthorityState());
}, [desktopRuntime]);
```

At the top of both `refreshRojoStatus` and `runRojoAction`, use live refs and handle dynamic runtime loss visibly:

```tsx
if (
  !desktopRuntime ||
  !mountedRef.current ||
  !studioSyncExpandedRef.current
) {
  return;
}

if (!isTauriRuntime()) {
  rojoGenerationRef.current += 1;
  showRojoRuntimeUnavailable();
  return;
}

if (rojoOperationOwnerRef.current !== null) return;

const generation = rojoGenerationRef.current;
const operationId = ++rojoOperationSequenceRef.current;
rojoOperationOwnerRef.current = operationId;
```

Every post-await checkpoint must use the live generation and expansion refs:

```tsx
if (
  !mountedRef.current ||
  !studioSyncExpandedRef.current ||
  generation !== rojoGenerationRef.current
) {
  return;
}

if (!isTauriRuntime()) {
  rojoGenerationRef.current += 1;
  showRojoRuntimeUnavailable();
  return;
}
```

Both async functions release only their own lock in `finally`. If presentation was invalidated while the operation ran and the user has already reopened the panel, schedule one new authoritative status probe through state rather than recursively reusing a stale callback:

```tsx
finally {
  const ownsOperation = rojoOperationOwnerRef.current === operationId;
  const presentationIsCurrent =
    mountedRef.current &&
    studioSyncExpandedRef.current &&
    generation === rojoGenerationRef.current;
  const shouldReconcile =
    ownsOperation &&
    mountedRef.current &&
    studioSyncExpandedRef.current &&
    generation !== rojoGenerationRef.current &&
    isTauriRuntime();

  if (ownsOperation) rojoOperationOwnerRef.current = null;
  if (presentationIsCurrent) setRojoLoading(false);
  if (shouldReconcile) {
    setRojoReconcileTick((tick) => tick + 1);
  }
}
```

Add `rojoReconcileTick` to the expansion effect dependencies. The effect reruns after the stale owner settles, sees a free lock, and performs exactly one fresh `checkStatus`. A current successful Start/Stop retains its existing status follow-up under the same operation owner.

Wire the disclosure button to `handleStudioSyncToggle`. In the unmount cleanup, set `studioSyncExpandedRef.current = false` and increment `rojoGenerationRef`; do not pretend to cancel or release an external operation. Remove the silent runtime checks from `handleStartServe` and `handleStopServe` so both delegate to `runRojoAction`, whose dynamic guard clears stale installed UI and shows the neutral Desktop-required state. Apply the same visible dynamic guard to Refresh.

- [ ] **Step 4: Run all focused regression tests**

```powershell
npm run test:run -- src/features/templates/TemplateSelector.setupChecklist.test.tsx src/features/settings/SettingsPage.authority.test.tsx src/features/settings/SettingsPage.robloxAuthority.test.tsx src/features/build/BuildPage.export.test.tsx src/features/publish/PublishPage.robloxAuthority.test.tsx
```

Expected: all focused tests PASS. Publish and Build tests prove the optional integration did not become a gate.

- [ ] **Step 5: Commit concurrency hardening if this task changed files**

```powershell
git add src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.authority.test.tsx
git commit -m "test: harden optional Studio sync concurrency"
```

If Step 3 required no production change because Task 2 already satisfies the tests, amend the Settings test commit only when it has not been pushed; otherwise create the test-only commit above.

### Task 4: Full verification, live QA, package, and durable save

**Files:**
- Verify all tracked source files
- Build artifacts: `src-tauri/target/release/bundle/nsis/RobloxForge_0.1.0_x64-setup.exe`
- Build artifacts: `src-tauri/target/release/bundle/msi/RobloxForge_0.1.0_x64_en-US.msi`

- [ ] **Step 1: Run the complete frontend and worker gates**

```powershell
npm run typecheck
npm run typecheck:worker
npm run test:worker:migrations
npm run test:run -- --maxWorkers=1
npm run build
```

Expected: every command exits zero, the full Vitest suite remains at least the current 40 files / 453 tests plus the new cases, and Vite produces a production bundle.

- [ ] **Step 2: Run Rust/Tauri regression gates**

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml --all-targets
cargo test --manifest-path src-tauri/Cargo.toml --all-targets
```

Expected: formatting and check pass; all existing Rust tests pass with no authority-contract changes.

- [ ] **Step 3: Perform live browser QA at the existing preview URL**

Open `http://127.0.0.1:5173/` and verify:

1. Home Getting Started shows `/2`, contains no `Install Rojo`, and creates no Rojo console/runtime error.
2. `/settings` shows `Advanced Studio Sync`, `Optional`, and the exact no-requirement promise while collapsed.
3. Expanding in browser shows the neutral Desktop explanation and no warning alert.
4. Collapse/reopen works without stale content.
5. `/build` still presents Studio testing only as an optional post-export action.
6. `/publish` renders verified target authority without any Rojo requirement.

Capture screenshots of Home and collapsed/expanded Settings for review evidence.

- [ ] **Step 4: Build and smoke-test the Desktop package**

```powershell
npm run tauri -- build
```

Expected artifacts:

```text
src-tauri\target\release\bundle\nsis\RobloxForge_0.1.0_x64-setup.exe
src-tauri\target\release\bundle\msi\RobloxForge_0.1.0_x64_en-US.msi
```

Launch `src-tauri\target\release\roblox-forge.exe`, confirm it stays running, open Settings, and verify the collapsed optional panel makes no Rojo probe until opened. Do not replace or uninstall Steve's existing packaged-app-virtualized installation during this smoke test.

- [ ] **Step 5: Restore generated tracked output if Vite changed it**

Check `git status --short`. If `dist/index.html` is tracked and changed only because of hashed production assets, restore its pre-build tracked content with `apply_patch`; do not use shell redirection and do not discard any unrelated user change. Confirm only intended source, tests, and approved documentation remain.

- [ ] **Step 6: Request independent review**

Ask the reviewer to verify the approved design's ten test points, especially zero eager Rojo calls, neutral browser/missing states, collapse invalidation, and unchanged Publish authority. Resolve every important finding and rerun the affected gates.

- [ ] **Step 7: Push and create the required immutable save**

```powershell
git status --short --branch
git push origin codex/private-alpha-sprint
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Steve\.codex\scripts\codex-save-repo.ps1 -ProjectName "roblox-forge-3dhuboz" -NoDevMap
```

Expected: the named branch is on the validated GitHub remote and the credential-redacted manifest plus verified all-refs bundle are written under `D:\GitHubBackup\roblox-forge-3dhuboz\codex-saves\STEVES-Steve`.

## Definition of done

- Getting Started has exactly two requirements and makes zero Rojo calls.
- Settings makes zero Rojo calls while Advanced Studio Sync is collapsed.
- Browser expansion is neutral and command-free.
- Desktop expansion performs the first status check exactly once.
- Missing Rojo is optional information, not an alert or product-readiness failure.
- Installed Rojo refresh/start/stop remains usable after opt-in.
- Collapse, runtime loss, unmount, and newer attempts defeat stale results.
- Build, Publish, Open Cloud authority, analytics, and Rust contracts are unchanged.
- Focused tests, full tests, typechecks, production build, Rust tests, Desktop package build, and live QA pass.
- Intended commits are pushed and the D-drive immutable save verifies successfully.
