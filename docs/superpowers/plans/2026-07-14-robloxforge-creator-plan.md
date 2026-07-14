# RobloxForge Creator and 3D Private Alpha Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a truthful Steve-only create-understand-approve workflow, versioned Game Operating Model editor, transactional proposal/undo system, responsive performant R3F builder, and honest test/publish UI with automated frontend proof.

**Architecture:** The approved Game Operating Model is the single persistent source of truth. React feature screens render projections of that model, AI and manual edits both produce typed proposals, and only approved transactions create a new model version; Tauri receipts separately represent authoritative build, Studio, and publish evidence. Browser mode may render deterministic previews but can never satisfy an authoritative capability gate.

**Tech Stack:** React 19, TypeScript 5.8, Zustand 5, Tailwind CSS 4, React Router 7, React Three Fiber 9, Three.js, XYFlow 12, Tauri v2, Vitest, React Testing Library, Playwright, axe-core.

---

## Locked file ownership

| Owner | Exclusive paths in this program |
|---|---|
| Integration Lead | `package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/App.tsx`, `src/main.tsx`, `src/test/integration/**`, `e2e/**` |
| Intelligence Lead | `src/domain/game-model/**`, `src/domain/proposals/**`, `src/domain/director/**` |
| Creator Lead | `src/features/**`, `src/components/**`, `src/stores/creator*.ts`, `src/styles/**` |
| Platform Lead | `src/services/**`, `src/types/receipts.ts`, `src/types/runtimeCapabilities.ts`, `src-tauri/**` |

No lead edits another lead's exclusive files. Cross-lane changes are sequenced through the contracts in Tasks 2 and 5 and merged by the Integration Lead.

## Target file structure

- `src/domain/game-model/gameBrief.ts`: versioned creator intent contract.
- `src/domain/game-model/gameOperatingModel.ts`: canonical approved model types.
- `src/domain/game-model/gameOperatingModel.validation.ts`: pure invariant validation.
- `src/domain/proposals/operation.ts`: strict tagged operation union.
- `src/domain/proposals/proposal.reducer.ts`: immutable apply/invert logic.
- `src/types/receipts.ts`: privileged-operation receipt states.
- `src/types/runtimeCapabilities.ts`: authoritative versus preview capability contract.
- `src/services/runtimeCapabilities.ts`: Tauri/browser capability detection.
- `src/services/gameDirectorClient.ts`: typed brief, model, and proposal requests.
- `src/services/creatorProjectClient.ts`: managed-project lifecycle client.
- `src/services/validationClient.ts`: static/Studio evidence client.
- `src/services/publishClient.ts`: publish-preflight and receipt client.
- `src/features/create/**`: idea, references, and managed-project creation.
- `src/features/understand/**`: editable understanding and approval gate.
- `src/features/operating-model/**`: model projections and invariant visibility.
- `src/features/proposals/**`: before/after review, approval, history, undo, and redo.
- `src/features/builder/**`: responsive shell, accessible scene tools, Director dock.
- `src/features/builder/viewport/**`: R3F projection, interaction, camera, quality, and resource lifecycle.
- `src/features/test/**`: browser preview versus authoritative Studio evidence.
- `src/features/publish/**`: preflight and partial-success-aware receipts.
- `src/test/integration/**`: complete React workflow tests.
- `e2e/**`: responsive, accessibility, truth-boundary, and publish-gating proof.

### Task 1: Restore a truthful frontend build and test baseline

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke/AppContract.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/ToastContainer.tsx`
- Modify: `src/features/build/BuildPage.tsx`
- Modify: `src/features/build/GuidedWizard.tsx`
- Modify: `src/features/build/InstanceExplorer.tsx`
- Modify: `src/features/builder/AiSceneChat.tsx`
- Modify: `src/features/builder/BuilderToolbar.tsx`
- Modify: `src/features/builder/ElementPalette.tsx`
- Modify: `src/features/builder/PropertiesPanel.tsx`
- Modify: `src/features/builder/VisualScriptEditor.tsx`
- Modify: `src/features/builder/nodes/ScriptNode.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/onboarding/OnboardingFlow.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/templates/TemplateSelector.tsx`
- Modify: `src/features/validation/ValidationPanel.tsx`
- Modify: `src/lib/gameLogic.ts`
- Modify: `src/lib/luauCodeGen.ts`
- Modify: `src/lib/templatePresets.ts`
- Modify: `src/services/browserDevMocks.ts`
- Modify: `src/stores/visualScriptStore.ts`

- [ ] **Step 1: Run the existing bounded checks and record the real baseline**

Run: `npm run build`

Expected: FAIL or timeout is recorded verbatim; do not treat an existing `dist` directory as proof.

Run: `npm test -- --run`

Expected: FAIL with `Missing script: "test"`.

- [ ] **Step 2: Add deterministic test and verification scripts**

Add these scripts and development dependencies to `package.json`, preserving existing scripts and versions:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit --pretty false",
    "test": "vitest",
    "test:run": "vitest run",
    "test:integration": "vitest run src/test/integration",
    "test:e2e": "playwright test",
    "verify:frontend": "npm run typecheck && npm run test:run && npm run build"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@vitejs/plugin-react": "^4.6.0",
    "axe-core": "^4.10.3",
    "jsdom": "^26.1.0",
    "vitest": "^3.2.4"
  }
}
```

Install only through:

`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Steve\.codex\scripts\codex-install-dependencies.ps1`

Expected: PASS with a serialized, non-junction `node_modules` tree.

- [ ] **Step 3: Add the Vitest and Playwright harness**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev:web",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
  ],
});
```

- [ ] **Step 4: Write the failing route smoke test**

Create `src/test/smoke/AppContract.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../../App";

describe("creator route shell", () => {
  it("exposes an accessible loading state", () => {
    render(<MemoryRouter initialEntries={["/create"]}><App /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveAccessibleName("Loading RobloxForge");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test:run -- src/test/smoke/AppContract.test.tsx`

Expected: FAIL because the existing spinner has no `role="status"` or accessible name.

- [ ] **Step 6: Make the loading contract accessible and remove strict-build blockers**

In `src/App.tsx`, replace the Suspense spinner with:

```tsx
<div
  role="status"
  aria-label="Loading RobloxForge"
  className="flex h-full items-center justify-center"
>
  <div aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
</div>
```

In `src/features/build/BuildPage.tsx`, remove the unused `refreshProjectState` binding. In `src/features/builder/AiSceneChat.tsx`, remove the unused `projectPath` prop until Task 5 replaces the component with a typed Director client.

Resolve every additional error recorded by the current `tsc` baseline with the smallest behavior-preserving type or dead-code correction. In particular, use the current Lucide icon component type instead of inferring impossible `never` props, make XYFlow `NodeData` satisfy its `Record<string, unknown>` constraint, type the connection validator for both connection and edge inputs, add the missing `structure` palette category, and remove genuinely unused symbols. Do not weaken `strict`, `noUnusedLocals`, or `noUnusedParameters`, add casts through `unknown`, or suppress errors.

- [ ] **Step 7: Run baseline verification**

Run: `npm run test:run -- src/test/smoke/AppContract.test.tsx`

Expected: PASS, one test.

Run: `npm run typecheck`

Expected: PASS with exit code 0.

Run: `npm run build`

Expected: PASS and Vite reports emitted chunks; no process remains running.

- [ ] **Step 8: Commit the baseline**

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts src/test/setup.ts src/test/smoke/AppContract.test.tsx src/App.tsx src/components src/features src/lib src/services/browserDevMocks.ts src/stores/visualScriptStore.ts
git commit -m "test: establish truthful frontend baseline"
```

### Task 2: Define the Game Brief, Game Operating Model, receipts, and runtime truth

**Files:**
- Create: `src/domain/game-model/gameBrief.ts`
- Create: `src/domain/game-model/gameOperatingModel.ts`
- Create: `src/domain/game-model/gameOperatingModel.validation.ts`
- Create: `src/domain/game-model/__tests__/gameOperatingModel.validation.test.ts`
- Create: `src/types/receipts.ts`
- Create: `src/types/runtimeCapabilities.ts`
- Create: `src/services/runtimeCapabilities.ts`
- Modify: `src/services/tauriCommands.ts`
- Modify: `src/services/browserDevMocks.ts`
- Modify: `src/components/DevModeBanner.tsx`
- Create: `src/components/AuthoritativeStatusBadge.tsx`
- Create: `src/services/__tests__/browserNoFalseSuccess.test.ts`

- [ ] **Step 1: Write failing model and browser-truth tests**

Create `src/domain/game-model/__tests__/gameOperatingModel.validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateGameOperatingModel } from "../gameOperatingModel.validation";

describe("validateGameOperatingModel", () => {
  it("rejects a model with no player promise or core loop", () => {
    const result = validateGameOperatingModel({
      schemaVersion: 1,
      modelVersion: 1,
      projectId: "project-1",
      thesis: "",
      finalAchievement: "",
      firstSessionPromise: "",
      loops: { seconds: [], minutes: [], session: [], longTerm: [] },
      objectives: [], sceneNodes: [], progression: [], runtimeRules: [],
      feedbackContracts: [], acceptanceTests: [],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("missing_first_session_promise");
    expect(result.issues.map((issue) => issue.code)).toContain("missing_seconds_loop");
  });
});
```

Create `src/services/__tests__/browserNoFalseSuccess.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { browserCapabilities } from "../runtimeCapabilities";

describe("browser runtime truth", () => {
  it("cannot claim authoritative Roblox operations", () => {
    expect(browserCapabilities()).toEqual({
      runtime: "browser_preview",
      canCreateManagedProject: false,
      canBuildRojo: false,
      canRunStudio: false,
      canValidateAuthoritatively: false,
      canPublish: false,
      canReadOwnerAnalytics: false,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify missing contracts fail**

Run: `npm run test:run -- src/domain/game-model/__tests__/gameOperatingModel.validation.test.ts src/services/__tests__/browserNoFalseSuccess.test.ts`

Expected: FAIL with module-not-found errors for both new contracts.

- [ ] **Step 3: Add the canonical model contracts**

Create `src/domain/game-model/gameBrief.ts`:

```ts
export interface GameBrief {
  schemaVersion: 1;
  projectId: string;
  playerPromise: string;
  fantasy: string;
  primaryGenre: string;
  secondaryGenre?: string;
  audience: { maturity: "minimal" | "mild"; targetDevices: ("desktop" | "mobile" | "console")[]; sessionMinutes: number };
  references: { url: string; admiredTraits: string[] }[];
  direction: { visual: string; emotional: string; audio: string };
  assumptions: { id: string; text: string; confidence: number; material: boolean }[];
  materialQuestions: { id: string; question: string; answer?: string }[];
}
```

Create `src/domain/game-model/gameOperatingModel.ts`:

```ts
export type LoopScale = "seconds" | "minutes" | "session" | "longTerm";

export interface GameOperatingModel {
  schemaVersion: 1;
  modelVersion: number;
  projectId: string;
  thesis: string;
  finalAchievement: string;
  firstSessionPromise: string;
  loops: Record<LoopScale, string[]>;
  objectives: { id: string; title: string; dependsOn: string[]; successState: string; failureState: string; recovery: string }[];
  sceneNodes: { id: string; parentId: string | null; kind: "zone" | "stage" | "landmark" | "encounter" | "spawn"; name: string; position: [number, number, number] }[];
  progression: { id: string; gate: string; reward: string; source: string; sink?: string }[];
  runtimeRules: { id: string; authority: "server" | "client"; rule: string; antiExploit: string }[];
  feedbackContracts: { id: string; event: string; visual: string; audioAlternative: string; mobile: string }[];
  acceptanceTests: { id: string; traceIds: string[]; statement: string }[];
}
```

Create `src/domain/game-model/gameOperatingModel.validation.ts`:

```ts
import type { GameOperatingModel } from "./gameOperatingModel";

export interface ModelValidationIssue { code: string; path: string; message: string }
export interface ModelValidationResult { valid: boolean; issues: ModelValidationIssue[] }

export function validateGameOperatingModel(model: GameOperatingModel): ModelValidationResult {
  const issues: ModelValidationIssue[] = [];
  if (!model.firstSessionPromise.trim()) issues.push({ code: "missing_first_session_promise", path: "firstSessionPromise", message: "Define what the player experiences in the first session." });
  if (model.loops.seconds.length === 0) issues.push({ code: "missing_seconds_loop", path: "loops.seconds", message: "Define at least one second-to-second action." });
  if (model.objectives.some((objective) => !objective.successState || !objective.recovery)) issues.push({ code: "incomplete_objective", path: "objectives", message: "Every objective needs success and recovery states." });
  return { valid: issues.length === 0, issues };
}
```

- [ ] **Step 4: Consume the platform-owned receipt and capability contracts**

The Platform Lead creates the canonical generic `OperationReceipt<T>` in `src/types/receipts.ts`. Creator code imports it and `isAuthoritativeSuccess`; it must not redefine receipt states, retry safety, authority rules, timestamps, diagnostics, or recovery actions.

The Platform Lead also creates `src/types/runtimeCapabilities.ts` and `src/services/runtimeCapabilities.ts`:

```ts
export interface RuntimeCapabilities {
  runtime: "tauri_desktop" | "browser_preview";
  canCreateManagedProject: boolean;
  canBuildRojo: boolean;
  canRunStudio: boolean;
  canValidateAuthoritatively: boolean;
  canPublish: boolean;
  canReadOwnerAnalytics: boolean;
}
```

```ts
import type { RuntimeCapabilities } from "../types/runtimeCapabilities";

export const browserCapabilities = (): RuntimeCapabilities => ({
  runtime: "browser_preview",
  canCreateManagedProject: false,
  canBuildRojo: false,
  canRunStudio: false,
  canValidateAuthoritatively: false,
  canPublish: false,
  canReadOwnerAnalytics: false,
});
```

Modify `src/services/tauriCommands.ts` so browser calls return `unavailable` or explicitly `simulated` receipts. Remove mock authenticated users, empty-success validation, successful publishing, and real-looking analytics from `src/services/browserDevMocks.ts`.

- [ ] **Step 5: Make preview status persistent in the UI**

Create `src/components/AuthoritativeStatusBadge.tsx`:

```tsx
export function AuthoritativeStatusBadge({ authoritative }: { authoritative: boolean }) {
  return <span className={authoritative ? "text-emerald-300" : "text-amber-300"}>{authoritative ? "Authoritative evidence" : "Preview only"}</span>;
}
```

Modify `src/components/DevModeBanner.tsx` to render `Preview only — browser data cannot validate, publish, authenticate with Roblox, or show owner analytics.` whenever `runtime === "browser_preview"`.

- [ ] **Step 6: Run tests and commit the truth boundary**

Run: `npm run test:run -- src/domain/game-model/__tests__/gameOperatingModel.validation.test.ts src/services/__tests__/browserNoFalseSuccess.test.ts`

Expected: PASS, two tests.

Run: `npm run typecheck`

Expected: PASS.

```powershell
git add src/domain/game-model src/types/receipts.ts src/types/runtimeCapabilities.ts src/services/runtimeCapabilities.ts src/services/tauriCommands.ts src/services/browserDevMocks.ts src/services/__tests__/browserNoFalseSuccess.test.ts src/components/DevModeBanner.tsx src/components/AuthoritativeStatusBadge.tsx
git commit -m "feat: establish model and runtime truth contracts"
```

### Task 3: Implement create, understand, and approve

**Files:**
- Create: `src/services/creatorProjectClient.ts`
- Create: `src/services/gameDirectorClient.ts`
- Create: `src/stores/creatorProjectStore.ts`
- Create: `src/features/create/CreatePage.tsx`
- Create: `src/features/create/IdeaComposer.tsx`
- Create: `src/features/create/ReferenceExperienceInput.tsx`
- Create: `src/features/understand/UnderstandPage.tsx`
- Create: `src/features/understand/UnderstandingSummary.tsx`
- Create: `src/features/understand/MaterialQuestionList.tsx`
- Create: `src/features/understand/ApprovalBar.tsx`
- Modify: `src/features/templates/TemplateSelector.tsx`
- Modify: `src/stores/projectStore.ts`
- Modify: `src/App.tsx`
- Create: `src/test/integration/create-understand-approve.test.tsx`

- [ ] **Step 1: Write the failing journey test**

Create `src/test/integration/create-understand-approve.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreatePage } from "../../features/create/CreatePage";

describe("create understand approve", () => {
  it("does not approve until material questions are answered", async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue({ projectId: "p1" });
    render(<CreatePage createProject={create} />);
    await user.type(screen.getByLabelText("Describe your game"), "An obby where every stage teaches one movement skill");
    await user.click(screen.getByRole("button", { name: "Understand my game" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ idea: expect.stringContaining("obby") }));
  });
});
```

- [ ] **Step 2: Run the test to verify the feature is absent**

Run: `npm run test:run -- src/test/integration/create-understand-approve.test.tsx`

Expected: FAIL because `CreatePage` does not exist.

- [ ] **Step 3: Add the managed-project lifecycle store**

Create `src/stores/creatorProjectStore.ts` with this state machine:

```ts
export type CreatorProjectPhase = "draft" | "understanding" | "model_pending_approval" | "approved" | "generated" | "studio_verified" | "privately_published";

export interface CreatorProjectState {
  projectId: string | null;
  phase: CreatorProjectPhase;
  briefVersion: number | null;
  modelVersion: number | null;
  error: string | null;
}
```

The store action `createDraft(input)` must set `understanding` only after `creatorProjectClient.create` returns a successful authoritative receipt. It must preserve `draft` and expose the receipt message on failure.

- [ ] **Step 4: Add typed project and Director clients**

Create `src/services/creatorProjectClient.ts`:

```ts
import type { OperationReceipt } from "../types/receipts";

export interface CreateProjectInput { idea: string; references: { url: string; admiredTraits: string[] }[] }
export interface ManagedProject { projectId: string; name: string }
export interface CreatorProjectClient { create(input: CreateProjectInput): Promise<OperationReceipt<ManagedProject>> }
```

Create `src/services/gameDirectorClient.ts`:

```ts
import type { GameBrief } from "../domain/game-model/gameBrief";
import type { GameOperatingModel } from "../domain/game-model/gameOperatingModel";
import type { OperationReceipt } from "../types/receipts";

export interface GameDirectorClient {
  interpret(projectId: string, idea: string, references: string[]): Promise<OperationReceipt<GameBrief>>;
  reviseBrief(projectId: string, brief: GameBrief): Promise<OperationReceipt<GameBrief>>;
  proposeModel(projectId: string, brief: GameBrief): Promise<OperationReceipt<GameOperatingModel>>;
}
```

- [ ] **Step 5: Implement the create and understand screens**

Create `src/features/create/CreatePage.tsx` with an injected `createProject` action, labelled idea textarea, reference list, submit state, and inline receipt failure. Create `UnderstandPage.tsx` to render player promise, fantasy, core loops, progression/recovery, direction, assumptions with confidence, and material questions. `ApprovalBar` receives `validation.valid`, unanswered material-question count, and receipt state; it enables approval only when all three are satisfied.

Use this approval predicate:

```ts
export const canApproveModel = (valid: boolean, unansweredMaterialQuestions: number, receiptState: string) =>
  valid && unansweredMaterialQuestions === 0 && receiptState === "succeeded";
```

Modify `TemplateSelector.tsx` so a selection seeds `CreatePage` rather than creating a project. Recent entries store and reopen the returned managed `projectId`. Modify `projectStore.ts` so create/validation failures return failed receipts and never resolve as success.

- [ ] **Step 6: Wire routes**

Modify `src/App.tsx` to lazy-load and route `/create`, `/understand/:projectId`, `/model/:projectId`, `/build/:projectId`, `/test/:projectId`, and `/publish/:projectId`. Redirect `/` to `/create`. Route components retrieve only managed IDs from parameters.

- [ ] **Step 7: Run the journey tests and commit**

Run: `npm run test:run -- src/test/integration/create-understand-approve.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```powershell
git add src/services/creatorProjectClient.ts src/services/gameDirectorClient.ts src/stores/creatorProjectStore.ts src/features/create src/features/understand src/features/templates/TemplateSelector.tsx src/stores/projectStore.ts src/App.tsx src/test/integration/create-understand-approve.test.tsx
git commit -m "feat: add create understand approve journey"
```

### Task 4: Add the Game Operating Model UI

**Files:**
- Create: `src/stores/creatorModelUiStore.ts`
- Create: `src/features/operating-model/GameOperatingModelPage.tsx`
- Create: `src/features/operating-model/LoopTimeline.tsx`
- Create: `src/features/operating-model/ObjectiveGraphView.tsx`
- Create: `src/features/operating-model/ProgressionView.tsx`
- Create: `src/features/operating-model/RulesAndRecoveryView.tsx`
- Create: `src/features/operating-model/MobilePerformanceBudgetView.tsx`
- Create: `src/features/operating-model/AcceptanceContractView.tsx`
- Create: `src/features/operating-model/ModelValidationSummary.tsx`
- Create: `src/features/operating-model/ModelTraceLink.tsx`
- Create: `src/features/operating-model/__tests__/GameOperatingModelPage.test.tsx`

- [ ] **Step 1: Write a failing model-trace test**

Create `src/features/operating-model/__tests__/GameOperatingModelPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameOperatingModelPage } from "../GameOperatingModelPage";
import { validObbyModel } from "../../../domain/game-model/gameOperatingModel.fixtures";

describe("GameOperatingModelPage", () => {
  it("shows version, loops, recovery, mobile contract, and acceptance trace", () => {
    render(<GameOperatingModelPage model={validObbyModel} />);
    expect(screen.getByText("Model v1")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Second-to-second loop" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Failure and recovery" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mobile and performance" })).toBeVisible();
    expect(screen.getByRole("link", { name: /trace to objective/i })).toHaveAttribute("href", "#objective-first-stage");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- src/features/operating-model/__tests__/GameOperatingModelPage.test.tsx`

Expected: FAIL because the model page and fixture do not exist.

- [ ] **Step 3: Add the complete Obby fixture and projection components**

Create `src/domain/game-model/gameOperatingModel.fixtures.ts` with a valid model containing a first-stage objective, seconds/minutes/session/long-term loops, recovery rule, mobile feedback contract, and acceptance test traced to `objective-first-stage`. Implement the listed projection components as pure views over `GameOperatingModel`; they do not own model copies.

Create `src/stores/creatorModelUiStore.ts` with UI-only state:

```ts
export interface CreatorModelUiState {
  selectedSection: "overview" | "loops" | "objectives" | "progression" | "rules" | "mobile" | "acceptance";
  selectedTraceId: string | null;
  expandedObjectiveIds: string[];
  compareMode: boolean;
}
```

`ObjectiveGraphView` may use XYFlow for layout, but semantic edits emit proposal requests and never call `setNodes` as persistent domain state.

- [ ] **Step 4: Render validation and traceability**

`GameOperatingModelPage` must render model/schema versions, approval state, `ModelValidationSummary`, and every acceptance test's trace IDs. Use anchors whose IDs equal stable model IDs. Invalid models render an error summary and disable Build navigation.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:run -- src/features/operating-model/__tests__/GameOperatingModelPage.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```powershell
git add src/domain/game-model/gameOperatingModel.fixtures.ts src/stores/creatorModelUiStore.ts src/features/operating-model
git commit -m "feat: add game operating model workspace"
```

### Task 5: Implement typed proposals, approval, undo, and redo

**Files:**
- Create: `src/domain/proposals/operation.ts`
- Create: `src/domain/proposals/proposal.ts`
- Create: `src/domain/proposals/proposal.reducer.ts`
- Create: `src/domain/proposals/__tests__/proposal.reducer.test.ts`
- Create: `src/stores/creatorProposalUiStore.ts`
- Create: `src/features/proposals/ProposalQueue.tsx`
- Create: `src/features/proposals/ProposalCard.tsx`
- Create: `src/features/proposals/ProposalDiff.tsx`
- Create: `src/features/proposals/BeforeAfterViewport.tsx`
- Create: `src/features/proposals/HistoryDrawer.tsx`
- Modify: `src/features/builder/AiSceneChat.tsx`
- Create: `src/test/integration/proposal-undo-redo.test.tsx`

- [ ] **Step 1: Write the failing reducer round-trip test**

Create `src/domain/proposals/__tests__/proposal.reducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validObbyModel } from "../../game-model/gameOperatingModel.fixtures";
import { applyProposal, invertProposal } from "../proposal.reducer";
import type { Proposal } from "../proposal";

describe("proposal transactions", () => {
  it("applies and exactly reverses a scene update", () => {
    const proposal: Proposal = {
      id: "proposal-1", projectId: "project-1", baseModelVersion: 1,
      rationale: "Move the first landmark into the onboarding sightline",
      traceIds: ["objective-first-stage"], risk: "low",
      operations: [{ type: "scene.update", nodeId: "landmark-start", before: { position: [0, 0, 0] }, after: { position: [8, 0, 0] } }],
    };
    const changed = applyProposal(validObbyModel, proposal);
    expect(changed.modelVersion).toBe(2);
    expect(applyProposal(changed, invertProposal(proposal))).toEqual(validObbyModel);
  });
});
```

- [ ] **Step 2: Run the reducer test to verify it fails**

Run: `npm run test:run -- src/domain/proposals/__tests__/proposal.reducer.test.ts`

Expected: FAIL because proposal contracts do not exist.

- [ ] **Step 3: Define the strict operation and proposal contracts**

Create `src/domain/proposals/operation.ts`:

```ts
export type ModelOperation =
  | { type: "scene.add"; node: { id: string; parentId: string | null; kind: "zone" | "stage" | "landmark" | "encounter" | "spawn"; name: string; position: [number, number, number] } }
  | { type: "scene.update"; nodeId: string; before: { position: [number, number, number] }; after: { position: [number, number, number] } }
  | { type: "scene.remove"; nodeId: string; before: { id: string; parentId: string | null; kind: "zone" | "stage" | "landmark" | "encounter" | "spawn"; name: string; position: [number, number, number] } }
  | { type: "objective.update"; objectiveId: string; before: { successState: string; recovery: string }; after: { successState: string; recovery: string } }
  | { type: "progression.update"; progressionId: string; before: { gate: string; reward: string }; after: { gate: string; reward: string } };
```

Create `src/domain/proposals/proposal.ts`:

```ts
import type { ModelOperation } from "./operation";

export interface Proposal {
  id: string;
  projectId: string;
  baseModelVersion: number;
  rationale: string;
  traceIds: string[];
  risk: "low" | "medium" | "high";
  operations: ModelOperation[];
}
```

- [ ] **Step 4: Implement immutable apply and inverse transactions**

Create `proposal.reducer.ts`. It must reject a mismatched `baseModelVersion`, clone only changed collections, increment exactly one version per committed proposal, and construct inverse operations in reverse order. Inverse application returns the prior model content and prior `modelVersion`; it does not add another user-visible model version.

- [ ] **Step 5: Implement proposal review UI and replace local fake AI**

`creatorProposalUiStore` owns queue IDs, selected proposal, preview state, and history cursor only. `ProposalCard` renders rationale, trace, risk, operation count, Preview, Reject, and Approve. `ProposalDiff` renders typed before/after fields. `HistoryDrawer` exposes undo/redo only for committed transactions.

Modify `AiSceneChat.tsx` so sending text calls a typed Director proposal endpoint and enqueues its receipt value. Remove local keyword matching, randomized waits, direct canvas mutation, and fake success prose.

- [ ] **Step 6: Write and run the UI undo test**

Create `src/test/integration/proposal-undo-redo.test.tsx` that approves a position proposal, asserts the new coordinates/version, clicks Undo, asserts the original coordinates/version, clicks Redo, and asserts the approved coordinates/version.

Run: `npm run test:run -- src/domain/proposals/__tests__/proposal.reducer.test.ts src/test/integration/proposal-undo-redo.test.tsx`

Expected: PASS, reducer and UI history both round-trip exactly.

- [ ] **Step 7: Commit proposal transactions**

```powershell
git add src/domain/proposals src/stores/creatorProposalUiStore.ts src/features/proposals src/features/builder/AiSceneChat.tsx src/test/integration/proposal-undo-redo.test.tsx
git commit -m "feat: add transactional creator proposals"
```

### Task 6: Build the responsive, accessible, bounded R3F editor

**Files:**
- Modify: `src/features/build/BuildPage.tsx`
- Modify: `src/features/build/InstanceExplorer.tsx`
- Modify: `src/features/build/PropertyInspector.tsx`
- Modify: `src/features/builder/GameCanvas3D.tsx`
- Modify: `src/features/builder/ElementPalette.tsx`
- Modify: `src/stores/canvasStore.ts`
- Modify: `src/stores/instanceStore.ts`
- Create: `src/features/builder/ResponsiveBuilderShell.tsx`
- Create: `src/features/builder/BuilderPanelDock.tsx`
- Create: `src/features/builder/SceneOutlineAccessible.tsx`
- Create: `src/features/builder/ViewportQualityMenu.tsx`
- Create: `src/features/builder/viewport/SceneProjection.tsx`
- Create: `src/features/builder/viewport/InstancedNodeGroup.tsx`
- Create: `src/features/builder/viewport/InteractionController.tsx`
- Create: `src/features/builder/viewport/CameraController.tsx`
- Create: `src/features/builder/viewport/SceneEnvironment.tsx`
- Create: `src/features/builder/__tests__/ResponsiveBuilderShell.test.tsx`
- Create: `src/features/builder/__tests__/dragTransaction.test.ts`

- [ ] **Step 1: Write failing responsive and drag-transaction tests**

Create `ResponsiveBuilderShell.test.tsx` to set `window.innerWidth` to 768, render the shell, and assert one `Open Explorer` button, one `Open Inspector` button, and a viewport region named `Game world preview`. Create `dragTransaction.test.ts` to begin a drag, update a transient transform, commit once, and assert exactly one proposal with the original `before` position and final `after` position.

- [ ] **Step 2: Run tests to verify current fixed panels and drag history fail**

Run: `npm run test:run -- src/features/builder/__tests__/ResponsiveBuilderShell.test.tsx src/features/builder/__tests__/dragTransaction.test.ts`

Expected: FAIL because the shell and transactional interaction controller do not exist.

- [ ] **Step 3: Consolidate the scene source of truth**

Change `canvasStore.ts` into transient viewport state only:

```ts
export interface CanvasInteractionState {
  selectedNodeId: string | null;
  activeTool: "select" | "place" | "move" | "delete";
  activeDrag: { nodeId: string; start: [number, number, number]; current: [number, number, number] } | null;
  quality: "low" | "medium" | "high";
}
```

Remove persistent element arrays and snapshot undo stacks. Reduce `instanceStore.ts` to explorer expansion and selection, or delete it after callers move to stable GOM scene-node selectors. Explorer, inspector, palette, viewport, generation, and proposal diffs must address the same scene-node IDs.

- [ ] **Step 4: Add responsive layout behavior**

Implement `ResponsiveBuilderShell` with these exact modes:

```ts
export type BuilderLayoutMode = "wide" | "laptop" | "narrow";
export const layoutModeForWidth = (width: number): BuilderLayoutMode =>
  width >= 1360 ? "wide" : width >= 900 ? "laptop" : "narrow";
```

Wide mode shows resizable explorer, viewport, and one inspector/Director dock. Laptop mode shows the viewport plus one collapsible dock. Narrow mode shows the viewport with modal bottom sheets. Never render the previous simultaneous fixed 280px, 300px, and 340px panels.

- [ ] **Step 5: Split and bound the R3F scene**

`GameCanvas3D.tsx` becomes a thin Canvas owner:

```tsx
<Canvas
  aria-label="Game world preview"
  frameloop="demand"
  dpr={quality === "high" ? [1, 1.5] : [1, 1.25]}
  shadows={quality !== "low"}
  camera={{ position: [14, 12, 14], fov: 45, near: 0.1, far: 120 }}
>
  <SceneEnvironment quality={quality} />
  <SceneProjection model={model} quality={quality} />
  <InteractionController />
  <CameraController />
</Canvas>
```

`SceneProjection` groups compatible repeated nodes by geometry/material key and passes them to `InstancedNodeGroup`. `SceneEnvironment` memoizes textures and disposes them on cleanup. Cap the high shadow map at 1024, medium at 512, and disable low-tier shadows. Frame callbacks reuse vector refs and call `invalidate()` only during controls, drag, or explicit animation.

- [ ] **Step 6: Make scene editing accessible and transactional**

`SceneOutlineAccessible` renders the same scene as a labelled tree. Selecting a tree item selects the R3F node. Property inputs emit typed proposals. Pointer drag keeps positions in refs and emits one `scene.update` proposal on pointer-up. Keyboard arrow movement emits the same proposal after a 150 ms grouping window. Toolbar zoom calls `CameraController.focusDistance(delta)` rather than changing an unused scalar.

- [ ] **Step 7: Run builder tests and commit**

Run: `npm run test:run -- src/features/builder/__tests__/ResponsiveBuilderShell.test.tsx src/features/builder/__tests__/dragTransaction.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```powershell
git add src/features/build src/features/builder src/stores/canvasStore.ts src/stores/instanceStore.ts
git commit -m "feat: add responsive transactional 3d builder"
```

### Task 7: Add honest preview, validation, and publish states

**Files:**
- Create: `src/services/validationClient.ts`
- Create: `src/services/publishClient.ts`
- Modify: `src/features/preview/GamePreview.tsx`
- Modify: `src/features/preview/VisualScenePreview.tsx`
- Modify: `src/features/validation/ValidationPanel.tsx`
- Create: `src/features/test/TestPage.tsx`
- Create: `src/features/test/ValidationStageList.tsx`
- Create: `src/features/test/StudioHealthCard.tsx`
- Create: `src/features/test/AcceptanceEvidenceView.tsx`
- Create: `src/features/test/ArtifactIdentityCard.tsx`
- Modify: `src/features/publish/PublishPage.tsx`
- Create: `src/features/publish/PublishPreflight.tsx`
- Create: `src/features/publish/PublishReceiptView.tsx`
- Create: `src/test/integration/validation-publish-truth.test.tsx`

- [ ] **Step 1: Write the failing truth test**

Create `src/test/integration/validation-publish-truth.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValidationPanel } from "../../features/validation/ValidationPanel";

describe("validation truth", () => {
  it("does not treat an empty issue array as proof", () => {
    render(<ValidationPanel state="not_run" issues={[]} receipt={null} />);
    expect(screen.getByText("Authoritative validation has not run")).toBeVisible();
    expect(screen.queryByText("Validation Passed")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify current false success fails**

Run: `npm run test:run -- src/test/integration/validation-publish-truth.test.tsx`

Expected: FAIL because the current panel infers success from zero issues.

- [ ] **Step 3: Define validation and publish clients**

Create `validationClient.ts` with methods for schema, deterministic generation, static/Rojo, Studio health, and Studio acceptance receipts. Create `publishClient.ts` with preflight and publish methods. Both consume managed project/model IDs and hashes; neither accepts arbitrary paths or raw credentials.

Use this gate:

```ts
export interface PublishGateInput {
  approvedModelHash: string;
  artifactModelHash: string;
  staticReceiptAuthoritative: boolean;
  studioReceiptAuthoritative: boolean;
  placeSelected: boolean;
  canPublish: boolean;
}

export const canPublish = (input: PublishGateInput) =>
  input.approvedModelHash === input.artifactModelHash &&
  input.staticReceiptAuthoritative &&
  input.studioReceiptAuthoritative &&
  input.placeSelected &&
  input.canPublish;
```

- [ ] **Step 4: Implement explicit test states**

Change `ValidationPanel` to accept `not_run | running | failed | passed`. Only `passed` plus an authoritative succeeded receipt renders green. `TestPage` labels R3F as `Approximate browser preview`; Studio evidence is shown separately with receipt IDs, artifact hashes, acceptance traces, and timestamps. `VisualScenePreview` becomes an accessible map/outline only and must not display proof language.

- [ ] **Step 5: Implement private-publish and partial-success UI**

`PublishPreflight` lists every gate with pass/fail state. `PublishPage` disables upload until `canPublish` returns true. `PublishReceiptView` renders:

- `succeeded`: `Private place version uploaded`;
- `partial_success`: `Place version uploaded; metadata update failed`;
- `failed`: safe error and recovery action;
- `unavailable` or `simulated`: `Publishing requires RobloxForge desktop`.

Never render `public`, `live`, or `players can now find it` solely from a successful version upload.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:run -- src/test/integration/validation-publish-truth.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

```powershell
git add src/services/validationClient.ts src/services/publishClient.ts src/features/preview src/features/validation/ValidationPanel.tsx src/features/test src/features/publish src/test/integration/validation-publish-truth.test.tsx
git commit -m "feat: add honest test and private publish workflow"
```

### Task 8: Prove the complete frontend journey, responsiveness, and accessibility

**Files:**
- Create: `src/test/integration/browser-truth-boundary.test.tsx`
- Create: `src/test/integration/save-before-test.test.tsx`
- Create: `src/test/integration/recent-project-open.test.tsx`
- Create: `e2e/create-to-approved-model.spec.ts`
- Create: `e2e/builder-responsive.spec.ts`
- Create: `e2e/browser-preview-truth.spec.ts`
- Create: `e2e/keyboard-accessibility.spec.ts`
- Create: `e2e/publish-gating.spec.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/features/onboarding/OnboardingFlow.tsx`
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add integration tests for prior failure modes**

`browser-truth-boundary.test.tsx` asserts browser mode never renders authenticated Roblox, passed validation, owner analytics, or successful publish. `save-before-test.test.tsx` changes a property, attempts Test immediately, and asserts generation waits for the approved transaction receipt. `recent-project-open.test.tsx` clicks a recent item and asserts `creatorProjectClient.open(projectId)` rather than project recreation.

- [ ] **Step 2: Run integration tests before fixes**

Run: `npm run test:integration`

Expected: FAIL on at least the browser truth, save ordering, or recent-open assertion until all three contracts are wired.

- [ ] **Step 3: Complete semantic and reduced-motion support**

Modify `Layout.tsx` to add `aria-current="page"`, a labelled navigation landmark, and responsive drawer controls. Modify onboarding choice groups to use `fieldset`, `legend`, radio semantics for age/experience, and `aria-pressed` for multi-select goals. Add to `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Maintain a 44px minimum touch target for primary mobile controls and 12px minimum helper copy.

- [ ] **Step 4: Add complete Playwright journeys**

`create-to-approved-model.spec.ts` creates an Obby brief, answers a material question, approves the model, and reaches Build. `builder-responsive.spec.ts` runs at every configured viewport and asserts the canvas region remains at least 480px wide on laptop and fills narrow mode behind drawers. `browser-preview-truth.spec.ts` asserts Preview-only status and unavailable publish. `keyboard-accessibility.spec.ts` completes create/approve and selects/moves a scene node without pointer input, then runs `axe.run(document)`. `publish-gating.spec.ts` verifies stale artifact hashes disable Publish and partial success uses private-upload wording.

- [ ] **Step 5: Run the full frontend proof**

Run: `npm run test:integration`

Expected: PASS.

Run: `npm run test:e2e`

Expected: PASS for desktop, laptop, and narrow projects; no serious or critical axe violations.

Run: `npm run verify:frontend`

Expected: typecheck, all Vitest tests, and production build PASS sequentially.

- [ ] **Step 6: Commit the completed Creator frontend proof**

```powershell
git add src/test/integration e2e src/components/Layout.tsx src/features/onboarding/OnboardingFlow.tsx src/styles/globals.css
git commit -m "test: prove creator workflow and responsive truth"
```

- [ ] **Step 7: Run the repository save rule after Integration Lead review**

Run:

`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Steve\.codex\scripts\codex-save-repo.ps1`

Expected: intended commits pushed to the validated GitHub remote and a credential-redacted manifest plus verified all-refs bundle written under `D:\GitHubBackup\roblox-forge\codex-saves\<ComputerName>-<UserName>`; any failed push, bundle, or redaction check is a hard failure.

## Final execution acceptance

- Create failure never creates a recent project or navigates to Build.
- A valid, answered, approved Game Operating Model is required before generation.
- Manual edits and Director edits share one typed proposal and inverse-operation ledger.
- Explorer, inspector, viewport, generation, and tests address one canonical scene graph.
- Browser preview cannot claim Roblox authentication, validation, Studio proof, analytics, or publishing.
- R3F uses demand rendering, bounded DPR/shadows, shared resources, instancing, and no steady-state frame allocations or store writes.
- Laptop and narrow layouts preserve a usable viewport and accessible non-canvas scene controls.
- Empty scenes, deletions, and last-second changes persist before test/export.
- Validation requires an authoritative receipt; zero issues alone is not proof.
- Publish requires matching model/artifact hashes and authoritative static plus Studio receipts.
- Private upload and public release remain distinct states.
- Frontend typecheck, unit/integration tests, Playwright journeys, axe checks, and production build all pass.
