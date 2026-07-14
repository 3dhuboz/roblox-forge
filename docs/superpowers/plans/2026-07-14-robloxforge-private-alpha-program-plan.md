# RobloxForge Private Alpha Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coordinate the Intelligence, Creator, and Roblox Platform lanes into one verified Steve-only RobloxForge private alpha that completes the create, understand, build, Studio-test, private-publish, monitor, and improve loop.

**Architecture:** The program lands shared contracts and truthful runtime gates before parallel feature work. Each lead owns exclusive paths and commits small TDD slices; the Integration Lead reviews contracts, merges seams, runs the full matrix, and preserves release evidence. Reference rights are checked before ingestion, public radar evidence remains separate from private Steve-owned analytics, and the approved design spec plus the three lane plans are normative.

**Tech Stack:** React 19, TypeScript, Vitest, Playwright, React Three Fiber, Zustand, Rust, Tauri v2, Rojo 7, Roblox Studio MCP, Roblox Studio CLI, Roblox Open Cloud, Cloudflare Workers/D1, Clerk, OpenRouter, Git/GitHub.

---

## Normative inputs

- Design: `docs/superpowers/specs/2026-07-14-robloxforge-private-alpha-design.md`
- Intelligence plan: `docs/superpowers/plans/2026-07-14-robloxforge-intelligence-plan.md`
- Creator plan: `docs/superpowers/plans/2026-07-14-robloxforge-creator-plan.md`
- Platform plan: `docs/superpowers/plans/2026-07-14-robloxforge-platform-plan.md`
- Canonical repo: `D:\GitHubBackup\_working-repos\STEVES-Steve\roblox-forge`
- Branch: `codex/private-alpha-sprint`

## Ownership rule

Exactly one active agent owns an implementation path. Shared manifests, registries, route shells, generated contract versions, and lockfiles belong to the Integration Lead. Leads submit seam requirements instead of editing shared files concurrently.

### Task 1: Prove the clean baseline and install test tooling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Install dependencies through the serialized installer**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Steve\.codex\scripts\codex-install-dependencies.ps1
```

Expected: exit `0`, no `node_modules` junction, and one completed installer receipt.

- [ ] **Step 2: Record the pre-change baseline**

Run:

```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-fail-fast
```

Expected: preserve exact failures/timeouts as baseline evidence; do not interpret a timeout as a passing or failing test.

- [ ] **Step 3: Add a failing smoke test before wiring Vitest**

```tsx
import { render, screen } from "@testing-library/react";
import App from "../App";

it("renders an accessible application status", () => {
  render(<App />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
```

Run: `npm test -- --run src/test/smoke.test.tsx`

Expected: FAIL because the runner/setup or accessible status is absent.

- [ ] **Step 4: Add deterministic scripts and setup**

Add scripts:

```json
{
  "typecheck": "tsc --noEmit --pretty false",
  "test": "vitest",
  "test:run": "vitest run",
  "verify:frontend": "npm run typecheck && npm run test:run && npm run build"
}
```

Configure jsdom, Testing Library cleanup, and jest-dom in `vitest.config.ts` and `src/test/setup.ts`. Add `role="status"` and `aria-label="Loading RobloxForge"` to the Suspense fallback in `src/App.tsx`.

- [ ] **Step 5: Verify and commit**

Run: `npm run verify:frontend`

Expected: smoke test, typecheck, and production build exit `0`.

Commit: `git add package.json package-lock.json vitest.config.ts src/test src/App.tsx && git commit -m "test: establish truthful frontend baseline"`

### Task 2: Land canonical schemas and receipt contracts

**Files:**
- Follow the Intelligence plan Task 1 contract paths under `schemas/intelligence/**`.
- Follow the Platform plan Task 1 receipt paths.
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Dispatch the Intelligence Lead for schema fixtures**

Require failing valid/invalid fixture tests first. The resulting JSON Schemas forbid unknown fields, arbitrary filesystem commands, credentials, competitor revenue estimates, and reference ingestion without an allowed `sourceKind`, `rightsBasis`, `rightsEvidenceRef`, and `policyDecision`.

- [ ] **Step 2: Dispatch the Platform Lead for receipt contracts**

Require failing tests proving `simulated` cannot authorize build/validation/publish, `partial_success` requires a known external resource ID, and `outcome_unknown` is terminal, non-authoritative, carries artifact/input hashes but no external resource ID, fixes retry safety to `unsafe_without_reconciliation`, and disables automatic retry.

- [ ] **Step 3: Integrate dependencies and module registration**

Add only the dependencies required by the committed tests, register `platform` and `intelligence` modules, and keep command exposure unchanged until the secure replacements exist.

- [ ] **Step 4: Run conformance**

Run:

```powershell
npm run test:run -- tests/contracts/intelligence-schemas.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --test intelligence_contracts
cargo test --manifest-path src-tauri/Cargo.toml --test platform_receipts
```

Expected: TypeScript and Rust accept/reject the same fixtures and all receipt tests pass.

- [ ] **Step 5: Commit the seam**

Commit: `git add schemas tests/contracts src/intelligence src/types/receipts.ts src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/src/intelligence src-tauri/src/platform src-tauri/tests && git commit -m "feat: add versioned intelligence and receipt contracts"`

### Task 3: Remove unsafe legacy authority before feature expansion

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/ai/mod.rs`
- Modify: `src-tauri/src/commands/ai.rs`
- Modify: `src/services/tauriCommands.ts`
- Modify: `src/services/browserDevMocks.ts`
- Test: `src-tauri/tests/oauth_surface_absent.rs`
- Test: `src/services/__tests__/browserNoFalseSuccess.test.ts`

- [ ] **Step 1: Write failing invoke-surface and browser-truth tests**

```ts
it.each(["publish", "validate", "analytics", "roblox_auth"])(
  "does not simulate authoritative %s success in browser mode",
  async (operation) => {
    const receipt = await invokeBrowserOperation(operation);
    expect(["unavailable", "simulated"]).toContain(receipt.state);
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  },
);
```

```rust
#[test]
fn private_alpha_invoke_surface_has_no_oauth_or_raw_file_commands() {
    let names = registered_command_names();
    for forbidden in ["start_roblox_oauth", "handle_oauth_callback", "read_file", "write_file", "set_api_key"] {
        assert!(!names.contains(forbidden));
    }
}
```

- [ ] **Step 2: Run and observe failure**

Run:

```powershell
npm run test:run -- src/services/__tests__/browserNoFalseSuccess.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --test oauth_surface_absent
```

Expected: FAIL against the legacy command/mocking surface.

- [ ] **Step 3: Quarantine unsafe commands**

Unregister OAuth, raw filesystem, local AI-key, generic shell, and generic opener commands. For the Steve-only alpha, keep the Roblox Open Cloud API key solely in Windows Credential Manager behind a non-secret Rust handle; require `universe-places:write` and `universe.analytics:read` permissions and send it only as `x-api-key`. Replace browser success substitutions with typed `unavailable` or visibly `simulated` receipts. Replace direct AI command application with a temporary unavailable proposal service until the typed proposal lane lands.

- [ ] **Step 4: Verify and commit**

Run the focused tests and `npm run verify:frontend`.

Expected: all exit `0`; browser mode cannot unlock an authoritative gate.

Commit: `git add src-tauri/src src/services src/types && git commit -m "security: quarantine unsafe legacy authority"`

### Task 4: Build the first complete create-to-approved-model slice

**Files:**
- Execute Intelligence plan Tasks 2-3.
- Execute Creator plan phases for Create, Understand, Approval, and GOM overview.
- Modify: `src/App.tsx`
- Test: `src/test/integration/create-understand-approve.test.tsx`

- [ ] **Step 1: Write the cross-lane failing journey**

The test submits an Obby idea and a licensed or copy-enabled reference fixture with stored rights evidence, receives a typed brief, shows assumptions/material questions, rejects an invalid or rights-blocked GOM, approves the corrected model, records schema/knowledge versions, and enables Build only after approval. An arbitrary game URL alone must be blocked before any content is fetched or deconstructed.

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:run -- src/test/integration/create-understand-approve.test.tsx`

Expected: FAIL because the create/understand/model routes and lifecycle do not exist.

- [ ] **Step 3: Dispatch Intelligence and Creator tasks in contract order after the shared seam is green**

Use distinct specialist implementers, but serialize implementation tasks in the shared working tree: Intelligence lands the typed lifecycle first, then Creator consumes it. Each task receives a separate specification-compliance review followed by a code-quality review before the next task starts.

Intelligence owns model lifecycle and validation. Creator owns pages/stores. Integration owns routes and service adapters. Neither lead edits the other's files.

- [ ] **Step 4: Verify the milestone**

Run:

```powershell
npm run test:run -- src/test/integration/create-understand-approve.test.tsx src/domain
npm run typecheck
npm run build
```

Expected: valid Obby operating model reaches `approved`; generation remains gated before approval; all commands exit `0`.

- [ ] **Step 5: Commit integration**

Commit: `git add src/App.tsx src/domain src/features/create src/features/understand src/features/operating-model src/stores src/test/integration && git commit -m "feat: approve an intelligent game operating model"`

### Task 5: Run the specialist implementation lanes

**Files:**
- Intelligence Lead: execute remaining Intelligence plan tasks.
- Creator Lead: execute remaining Creator plan tasks.
- Platform Lead: execute Platform plan Tasks 2-9.

- [ ] **Step 1: Rotate three leads through exclusive paths**

Provide each lead the approved spec, its lane task text, current HEAD, exact exclusive paths, and required focused verification. Keep research and review work parallel where safe, but dispatch only one implementation task at a time in the shared working tree. Leads commit after each green task and report hashes.

- [ ] **Step 2: Review every lead commit before integration**

For each commit:

```powershell
git show --stat --oneline <commit>
git diff <commit>^ <commit> --check
```

Run its focused tests. Reject out-of-scope shared-file edits, duplicate contract types, fake success states, uncited intelligence, unverified reference rights, private owner metrics entering the corpus/radar, unbounded model/file operations, or undocumented verification gaps.

- [ ] **Step 3: Integrate shared seams one at a time**

After a lead's focused tests pass, the Integration Lead updates shared manifests, command registration, route wiring, and generated schema/version adapters. Run conformance after each seam; do not batch unrelated shared changes.

- [ ] **Step 4: Keep the plan and branch durable**

At every stable slice, push `codex/private-alpha-sprint`. Do not run multiple package managers or Cargo build processes concurrently in this worktree.

### Task 6: Prove the end-to-end private-alpha loop

**Files:**
- Create: `evidence/private-alpha/requirements.json`
- Create: `evidence/private-alpha/create-build-studio-publish.json`
- Create: `evidence/private-alpha/analytics-improvement.json`
- Create: `scripts/verify-private-alpha.ps1`
- Create: `docs/release/private-alpha-runbook.md`

- [ ] **Step 1: Write the verifier before the final proof**

The verifier fails unless evidence proves every explicit design requirement. Its requirements file records `requirementId`, `description`, `evidencePath`, `status`, and `hash`.

```powershell
$requirements = Get-Content -Raw $RequirementsPath | ConvertFrom-Json
$failed = @($requirements | Where-Object { $_.status -ne 'proven' -or -not (Test-Path -LiteralPath $_.evidencePath) })
if ($failed.Count -gt 0) {
  throw "Private alpha has $($failed.Count) unproven requirement(s)."
}
```

- [ ] **Step 2: Run all automated gates**

Run:

```powershell
npm run verify:frontend
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked --all-targets --no-fail-fast
cargo build --manifest-path src-tauri/Cargo.toml --locked --release
npm run tauri build
```

Expected: every command exits `0` and produces no unexplained tracked/generated mutation.

- [ ] **Step 3: Run the real-system proof**

Using Steve's allowlisted account, a credential-vault Open Cloud API key, and an already-created Steve-owned private test universe/place whose relationship and private visibility were verified before upload:

1. create and approve an original Obby from an idea plus a licensed or copy-enabled reference fixture whose `sourceKind`, `rightsBasis`, `rightsEvidenceRef`, and allowed `policyDecision` are preserved;
2. apply one typed visual/Director change and prove undo/redo hashes;
3. generate the canonical Rojo candidate artifact twice and compare hashes;
4. run Studio acceptance tests through the explicitly trusted official Studio MCP adapter, or the documented Studio CLI fallback, and preserve the selected-instance/adapter and exact artifact proof;
5. enforce the 10 MiB artifact limit and 30-per-minute owner budget, publish to the verified binding, and preserve the place-version receipt; a known version plus later metadata failure is `partial_success`, while a timeout/connection loss/5xx/malformed success is `outcome_unknown` and is never automatically retried;
6. query owner analytics through the beta Analytics Query API, poll any `202` operation, preserve `valid | projected | not_statistically_significant` point status, keep missing values absent rather than zero, and preserve an explicit budget/delay/no-data/unavailable receipt when appropriate;
7. approve one evidence-backed improvement;
8. rebuild, retest, and publish a second place version.

- [ ] **Step 4: Run the completion verifier**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-private-alpha.ps1`

Expected: exit `0` with every requirement marked `proven`.

- [ ] **Step 5: Commit release evidence**

Commit only credential-redacted evidence and hashes:

`git add evidence scripts/verify-private-alpha.ps1 docs/release/private-alpha-runbook.md && git commit -m "test: prove RobloxForge private alpha end to end"`

### Task 7: Push and create the verified durable save

- [ ] **Step 1: Verify final repository state**

Run:

```powershell
git status --short
git branch -vv
git remote -v
git log -5 --oneline --decorate
```

Expected: clean working tree, sprint branch tracking the validated GitHub origin.

- [ ] **Step 2: Push the sprint branch**

Run: `git push origin codex/private-alpha-sprint`

Expected: exit `0` and local/remote branch hashes match.

- [ ] **Step 3: Run the global durable save**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Steve\.codex\scripts\codex-save-repo.ps1
```

Expected: intended changes committed/pushed if any remain, redacted manifest written, all-refs bundle verified under `D:\GitHubBackup\roblox-forge\codex-saves\STEVES-Steve`, and no hard failure.

- [ ] **Step 4: Complete the active goal only after the requirement audit passes**

The Integration Lead maps every objective clause to authoritative evidence, inspects the evidence, and calls `update_goal(status="complete")` only when no requirement is missing, contradicted, weak, or indirect.
