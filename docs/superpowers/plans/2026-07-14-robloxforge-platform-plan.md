# RobloxForge Platform and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure local platform that contains projects, generates one authoritative Roblox artifact, proves it in Studio, publishes it to a Steve-owned place, queries owner analytics, and packages a truthful Windows alpha.

**Architecture:** Tauri Rust is the only privileged boundary. React addresses managed project IDs and receives typed receipts; it never supplies arbitrary filesystem paths or sees Roblox credentials. One pinned Rojo pipeline produces the artifact used by validation, Studio proof, and publishing, and every privileged operation returns a hash-linked receipt.

**Tech Stack:** Rust, Tauri v2, serde, reqwest, keyring/Windows Credential Manager, Tokio, Rojo 7, Roblox Studio MCP, Roblox Open Cloud Place Publishing and Analytics Query APIs, TypeScript contract adapters.

---

## Path ownership

- Platform Lead owns `src-tauri/src/platform/**`, `src-tauri/src/project/**`, `src-tauri/src/builder/**`, `src-tauri/src/roblox/**`, `src-tauri/src/studio/**`, `src-tauri/tests/platform_*.rs`, `src/services/runtimeCapabilities.ts`, `src/services/validationClient.ts`, `src/services/publishClient.ts`, and `src/types/receipts.ts`.
- Integration Lead alone edits `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `package.json`, and lockfiles.
- Intelligence Lead owns intelligence schemas and proposal semantics. Platform validates and applies those contracts but does not redefine them.

### Task 1: Establish platform receipt contracts

**Files:**
- Create: `src/types/receipts.ts`
- Create: `src-tauri/src/platform/mod.rs`
- Create: `src-tauri/src/platform/receipt.rs`
- Test: `src-tauri/tests/platform_receipts.rs`

- [ ] **Step 1: Write the failing Rust receipt tests**

```rust
use roblox_forge_lib::platform::receipt::{OperationReceipt, OperationState, RetrySafety};

#[test]
fn simulated_receipt_is_never_authoritative() {
    let receipt = OperationReceipt::simulated("build", "browser preview");
    assert_eq!(receipt.state, OperationState::Simulated);
    assert!(!receipt.is_authoritative_success());
}

#[test]
fn partial_success_preserves_external_resource_id() {
    let receipt = OperationReceipt::partial_success(
        "publish",
        "version upload succeeded; metadata update failed",
        "place-version:42",
        RetrySafety::UnsafeWithoutReconciliation,
    );
    assert_eq!(receipt.external_resource_id.as_deref(), Some("place-version:42"));
    assert_eq!(receipt.state, OperationState::PartialSuccess);
}
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_receipts`

Expected: FAIL because `platform::receipt` is not defined.

- [ ] **Step 3: Implement the receipt model**

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationState {
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    PartialSuccess,
    Unavailable,
    Simulated,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RetrySafety {
    Safe,
    UnsafeWithoutReconciliation,
    NotRetryable,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationReceipt {
    pub operation_id: String,
    pub correlation_id: String,
    pub operation: String,
    pub state: OperationState,
    pub authoritative: bool,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub input_hash: Option<String>,
    pub artifact_hash: Option<String>,
    pub external_resource_id: Option<String>,
    pub message: String,
    pub diagnostics: Vec<String>,
    pub retry_safety: RetrySafety,
    pub recovery_action: Option<String>,
    pub value: Option<serde_json::Value>,
}

impl OperationReceipt {
    pub fn is_authoritative_success(&self) -> bool {
        self.authoritative && self.state == OperationState::Succeeded
    }
}
```

Implement constructors used by the tests with UUID operation/correlation IDs and RFC3339 timestamps.

- [ ] **Step 4: Add the TypeScript mirror and exhaustive state guard**

```ts
export type OperationState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partial_success"
  | "unavailable"
  | "simulated";

export interface OperationReceipt<T = unknown> {
  operationId: string;
  correlationId: string;
  operation: string;
  state: OperationState;
  authoritative: boolean;
  startedAt: string;
  finishedAt?: string;
  inputHash?: string;
  artifactHash?: string;
  externalResourceId?: string;
  message: string;
  diagnostics: string[];
  retrySafety: "safe" | "unsafe_without_reconciliation" | "not_retryable";
  recoveryAction?: string;
  value?: T;
}

export const isAuthoritativeSuccess = <T>(receipt: OperationReceipt<T>): boolean =>
  receipt.authoritative && receipt.state === "succeeded";
```

- [ ] **Step 5: Run tests and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_receipts`

Expected: PASS.

Commit: `git add src/types/receipts.ts src-tauri/src/platform src-tauri/tests/platform_receipts.rs && git commit -m "feat: add privileged operation receipts"`

### Task 2: Enforce managed project roots

**Files:**
- Create: `src-tauri/src/platform/path_policy.rs`
- Modify: `src-tauri/src/project/manager.rs`
- Modify: `src-tauri/src/commands/project.rs`
- Test: `src-tauri/tests/platform_path_policy.rs`

- [ ] **Step 1: Write containment tests**

```rust
#[test]
fn rejects_absolute_and_parent_paths() {
    let policy = fixture_policy();
    assert!(policy.resolve_relative("project-a", r"C:\Windows\win.ini").is_err());
    assert!(policy.resolve_relative("project-a", "../outside.lua").is_err());
}

#[test]
fn rejects_reparse_escape_and_disallowed_extension() {
    let policy = fixture_policy();
    assert!(policy.resolve_relative("project-a", "src/secret.pem").is_err());
    assert!(policy.resolve_relative("project-a", "linked/outside.lua").is_err());
}

#[test]
fn accepts_bounded_project_source() {
    let policy = fixture_policy();
    let path = policy.resolve_relative("project-a", "src/server/Main.server.lua").unwrap();
    assert!(path.ends_with("Main.server.lua"));
}
```

- [ ] **Step 2: Verify the tests fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_path_policy`

Expected: FAIL because `PathPolicy` is absent.

- [ ] **Step 3: Implement one canonical resolver**

```rust
pub struct PathPolicy {
    projects_root: std::path::PathBuf,
    allowed_extensions: std::collections::HashSet<&'static str>,
    max_file_bytes: u64,
}

impl PathPolicy {
    pub fn resolve_relative(&self, project_id: &str, relative: &str) -> Result<std::path::PathBuf, PathPolicyError> {
        validate_project_id(project_id)?;
        let relative_path = std::path::Path::new(relative);
        if relative_path.is_absolute() || relative_path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
            return Err(PathPolicyError::EscapeAttempt);
        }
        validate_extension(relative_path, &self.allowed_extensions)?;
        let project_root = canonical_project_root(&self.projects_root, project_id)?;
        let candidate = project_root.join(relative_path);
        reject_reparse_chain(&project_root, &candidate)?;
        ensure_descendant(&project_root, &candidate)?;
        Ok(candidate)
    }
}
```

Allow only the project formats required by the approved generator: `.lua`, `.luau`, `.json`, `.toml`, `.md`, `.project.json`, and generated `.rbxl/.rbxlx` inside the dedicated build directory. Enforce depth, file-count, and byte quotas during recursion.

- [ ] **Step 4: Replace frontend-supplied paths with project IDs**

Change Tauri commands to accept `{ projectId, relativePath }`. Resolve every read, write, tree, build, validate, and AI-approved operation through the managed resolver. Return `OperationReceipt::failed` for policy violations without disclosing absolute host paths.

- [ ] **Step 5: Run tests and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_path_policy`

Expected: PASS for valid project files and PASS for all rejection cases.

Commit: `git add src-tauri/src/platform/path_policy.rs src-tauri/src/project/manager.rs src-tauri/src/commands/project.rs src-tauri/tests/platform_path_policy.rs && git commit -m "security: contain project filesystem access"`

### Task 3: Make project creation transactional

**Files:**
- Create: `src-tauri/src/project/transaction.rs`
- Modify: `src-tauri/src/project/manager.rs`
- Test: `src-tauri/tests/platform_project_transaction.rs`

- [ ] **Step 1: Write failure/rollback tests**

```rust
#[test]
fn failed_template_copy_leaves_no_visible_project() {
    let harness = ProjectHarness::new();
    harness.inject_copy_failure_after(2);
    assert!(harness.create("demo", "obby").is_err());
    assert!(!harness.projects_root().join("demo").exists());
    assert!(harness.staging_entries().is_empty());
}

#[test]
fn commit_is_atomic_and_writes_manifest_last() {
    let harness = ProjectHarness::new();
    harness.create("demo", "obby").unwrap();
    assert!(harness.projects_root().join("demo/.robloxforge/project.json").exists());
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_project_transaction`

Expected: FAIL because partial directories remain visible.

- [ ] **Step 3: Implement stage-validate-rename**

Create projects under `<projectsRoot>/.staging/<operationId>`, copy with quotas and no links, validate the resulting manifest and source tree, then rename atomically to the final managed project ID. Remove staging on error. Reject duplicate project IDs without modifying the existing project.

- [ ] **Step 4: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_project_transaction`

Expected: PASS.

Commit: `git add src-tauri/src/project src-tauri/tests/platform_project_transaction.rs && git commit -m "feat: create projects transactionally"`

### Task 4: Disable legacy OAuth exposure and secure credentials

**Files:**
- Create: `src-tauri/src/platform/credentials.rs`
- Modify: `src-tauri/src/commands/auth.rs`
- Modify: `src-tauri/src/state.rs`
- Test: `src-tauri/tests/platform_credentials.rs`

- [ ] **Step 1: Write tests proving secrets cannot serialize**

```rust
#[test]
fn credential_handle_serializes_without_secret() {
    let handle = CredentialHandle::configured("roblox-place-publisher", "universe:123");
    let json = serde_json::to_string(&handle).unwrap();
    assert!(!json.contains("api-key-value"));
    assert!(json.contains("configured"));
}

#[test]
fn private_alpha_auth_commands_do_not_return_oauth_tokens() {
    let value = get_private_alpha_auth_state_fixture();
    let json = serde_json::to_string(&value).unwrap();
    assert!(!json.contains("accessToken"));
    assert!(!json.contains("refreshToken"));
}
```

- [ ] **Step 2: Verify failure against the legacy DTO**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_credentials`

Expected: FAIL because the legacy auth state exposes tokens.

- [ ] **Step 3: Implement credential handles**

```rust
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialHandle {
    pub id: String,
    pub purpose: String,
    pub scope: String,
    pub configured: bool,
    pub last_verified_at: Option<String>,
}

pub trait CredentialVault: Send + Sync {
    fn put(&self, id: &str, secret: secrecy::SecretString) -> Result<(), CredentialError>;
    fn get(&self, id: &str) -> Result<secrecy::SecretString, CredentialError>;
    fn delete(&self, id: &str) -> Result<(), CredentialError>;
}
```

Use Windows Credential Manager through a maintained keyring crate. The private-alpha auth DTO contains only the allowlisted Clerk/operator state and credential handles. Do not register legacy Roblox OAuth start/callback/refresh commands in `lib.rs`.

- [ ] **Step 4: Add a redaction regression test**

Exercise debug/error serialization and assert the sentinel secret never appears in JSON, logs, receipt diagnostics, or panic messages.

- [ ] **Step 5: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_credentials`

Expected: PASS.

Commit: `git add src-tauri/src/platform/credentials.rs src-tauri/src/commands/auth.rs src-tauri/src/state.rs src-tauri/tests/platform_credentials.rs && git commit -m "security: keep Roblox credentials in Rust vault"`

### Task 5: Restore CSP and minimize capabilities

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/tests/platform_config.rs`

- [ ] **Step 1: Write configuration assertions**

```rust
#[test]
fn csp_is_enabled_and_shell_plugin_is_not_registered() {
    let config = load_json("tauri.conf.json");
    assert_ne!(config.pointer("/app/security/csp"), Some(&serde_json::Value::Null));
    let source = std::fs::read_to_string("src/lib.rs").unwrap();
    assert!(!source.contains("tauri_plugin_shell::init"));
}
```

- [ ] **Step 2: Verify the legacy configuration fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_config`

Expected: FAIL because CSP is disabled and shell registration drifts from capabilities.

- [ ] **Step 3: Apply the minimum policy**

Set a CSP that allows packaged application assets and the explicitly configured Cloudflare API origin, while denying object/frame embedding and unneeded sources. Remove the unused shell plugin and any capability not exercised by a registered private-alpha command.

- [ ] **Step 4: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_config`

Expected: PASS.

Commit: `git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/src/lib.rs src-tauri/tests/platform_config.rs && git commit -m "security: restrict Tauri webview capabilities"`

### Task 6: Package templates and pin one Rojo pipeline

**Files:**
- Create: `rokit.toml`
- Create: `src-tauri/src/builder/toolchain.rs`
- Create: `src-tauri/src/builder/artifact.rs`
- Modify: `src-tauri/src/builder/rojo.rs`
- Modify: `src-tauri/src/commands/build.rs`
- Modify: `src-tauri/tauri.conf.json`
- Test: `src-tauri/tests/platform_build_artifact.rs`

- [ ] **Step 1: Write artifact identity tests**

```rust
#[tokio::test]
async fn build_receipt_hashes_the_published_artifact() {
    let harness = BuildHarness::fixture("obby");
    let result = harness.build().await.unwrap();
    assert_eq!(result.receipt.artifact_hash.as_deref(), Some(result.sha256.as_str()));
    assert_eq!(sha256_file(&result.path).unwrap(), result.sha256);
}

#[test]
fn packaged_templates_are_declared_resources() {
    let config = load_json("tauri.conf.json");
    assert!(resource_list(&config).iter().any(|p| p.contains("templates")));
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_build_artifact`

Expected: FAIL because build and publish use divergent builders and templates are not bundled.

- [ ] **Step 3: Pin Rojo and implement cancellable execution**

Pin Rojo 7 in `rokit.toml`. Resolve the executable once, validate its version, run it via `tokio::process::Command`, drain stdout/stderr concurrently, enforce timeout/cancellation, and include the exact tool version in the receipt.

```rust
pub struct BuildArtifact {
    pub path: std::path::PathBuf,
    pub sha256: String,
    pub bytes: u64,
    pub project_revision: u64,
    pub gom_hash: String,
    pub generator_version: String,
    pub toolchain: ToolchainReceipt,
    pub receipt: OperationReceipt,
}
```

- [ ] **Step 4: Make build, Studio, and publish consume `BuildArtifact`**

Remove the native-builder-first/publish-with-Rojo split. Unsupported model properties or files fail validation; they are not silently dropped. Convert templates to valid Rojo 7 structure and test their manifest/hash presence in packaged resources.

- [ ] **Step 5: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_build_artifact`

Expected: PASS with one artifact hash across every consumer.

Commit: `git add rokit.toml src-tauri/src/builder src-tauri/src/commands/build.rs src-tauri/tauri.conf.json src-tauri/tests/platform_build_artifact.rs templates && git commit -m "feat: build one authoritative Rojo artifact"`

### Task 7: Add Studio companion health and proof receipts

**Files:**
- Create: `src-tauri/src/studio/mod.rs`
- Create: `src-tauri/src/studio/client.rs`
- Create: `src-tauri/src/studio/proof.rs`
- Create: `src-tauri/src/commands/studio.rs`
- Test: `src-tauri/tests/platform_studio_proof.rs`

- [ ] **Step 1: Write stale-proof and acceptance tests**

```rust
#[test]
fn stale_artifact_invalidates_studio_proof() {
    let proof = StudioProof::fixture("artifact-a", "gom-a");
    assert!(!proof.authorizes_publish("artifact-b", "gom-a"));
}

#[test]
fn proof_requires_every_required_acceptance_test() {
    let proof = StudioProof::fixture_with_failed_test("player_reaches_finish");
    assert!(!proof.is_authoritative_success());
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_studio_proof`

Expected: FAIL because the Studio proof contract does not exist.

- [ ] **Step 3: Implement the companion protocol**

Define health/version negotiation, artifact load, playtest start, acceptance-test result, performance sample, cancellation, and final proof messages. Bind every proof to project ID, GOM hash, artifact hash, Studio version, companion version, test IDs, timestamps, diagnostics, and an immutable receipt hash.

- [ ] **Step 4: Add a recorded-fixture adapter test**

Use a redacted Studio MCP fixture to prove protocol parsing without requiring Studio in CI. Keep the real Studio run as a separate release gate.

- [ ] **Step 5: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_studio_proof`

Expected: PASS.

Commit: `git add src-tauri/src/studio src-tauri/src/commands/studio.rs src-tauri/tests/platform_studio_proof.rs && git commit -m "feat: capture authoritative Studio test proof"`

### Task 8: Publish safely to a Steve-owned place

**Files:**
- Modify: `src-tauri/src/roblox/open_cloud.rs`
- Modify: `src-tauri/src/commands/publish.rs`
- Create: `src-tauri/src/roblox/http_client.rs`
- Test: `src-tauri/tests/platform_publish.rs`

- [ ] **Step 1: Write auth, retry, and partial-success tests**

```rust
#[tokio::test]
async fn place_publish_uses_api_key_not_bearer_auth() {
    let request = recorded_publish_request().await;
    assert!(request.headers.contains_key("x-api-key"));
    assert!(!request.headers.contains_key("authorization"));
}

#[tokio::test]
async fn metadata_failure_after_upload_is_partial_success() {
    let receipt = publish_harness().upload_ok_version(42).metadata_fails().run().await;
    assert_eq!(receipt.state, OperationState::PartialSuccess);
    assert_eq!(receipt.external_resource_id.as_deref(), Some("place-version:42"));
    assert_eq!(receipt.retry_safety, RetrySafety::UnsafeWithoutReconciliation);
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_publish`

Expected: FAIL because the legacy upload uses bearer auth and collapses partial success.

- [ ] **Step 3: Implement a hardened shared client**

Use explicit connect/request timeouts, bounded responses, redacted structured errors, capped `Retry-After`, and retries only for requests proven safe. Do not automatically retry an ambiguous Place Publishing POST.

- [ ] **Step 4: Enforce preflight evidence**

Publish requires matching approved GOM, build artifact, and Studio proof hashes; a configured universe/place credential handle; size under Roblox's documented place limit; and an explicit private deployment choice. Construct game URLs with `placeId`, not `universeId`.

- [ ] **Step 5: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_publish`

Expected: PASS.

Commit: `git add src-tauri/src/roblox src-tauri/src/commands/publish.rs src-tauri/tests/platform_publish.rs && git commit -m "feat: publish private place versions safely"`

### Task 9: Query real owner analytics without false zeroes

**Files:**
- Create: `src-tauri/src/roblox/analytics.rs`
- Modify: `src-tauri/src/commands/dashboard.rs`
- Create: `src/services/analyticsClient.ts`
- Test: `src-tauri/tests/platform_analytics.rs`

- [ ] **Step 1: Write asynchronous query and no-data tests**

```rust
#[tokio::test]
async fn accepted_query_polls_until_complete() {
    let result = analytics_harness().accepted_then_complete().query(owner_query()).await.unwrap();
    assert_eq!(result.series.len(), 1);
}

#[tokio::test]
async fn network_failure_is_unknown_not_zero() {
    let result = analytics_harness().network_failure().query(owner_query()).await;
    assert!(matches!(result, Err(AnalyticsError::Unavailable { .. })));
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_analytics`

Expected: FAIL because the current dashboard collapses failures to empty/zero data.

- [ ] **Step 3: Implement Analytics Query**

Support metric/dimension allowlists, bounded date ranges and data-point budgets, `202` polling with timeout/cancellation, `429` backoff, owner-universe authorization, place-version correlation, and explicit `available | delayed | no_data | unavailable` status.

```rust
pub struct OwnerAnalyticsEvidence {
    pub universe_id: u64,
    pub query_hash: String,
    pub observed_at: String,
    pub availability: AnalyticsAvailability,
    pub series: Vec<MetricSeries>,
    pub receipt: OperationReceipt,
}
```

- [ ] **Step 4: Run and commit**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_analytics`

Expected: PASS.

Commit: `git add src-tauri/src/roblox/analytics.rs src-tauri/src/commands/dashboard.rs src/services/analyticsClient.ts src-tauri/tests/platform_analytics.rs && git commit -m "feat: query owner Roblox analytics"`

### Task 10: Package and smoke-test the Windows alpha

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Create: `scripts/verify-packaged-alpha.ps1`
- Create: `docs/release/private-alpha-runbook.md`
- Test: `src-tauri/tests/platform_packaging.rs`

- [ ] **Step 1: Write packaged-resource tests**

Assert that the release bundle contains icons, templates, intelligence corpus manifest, Rojo toolchain instructions, and no `.env`, private key, API key, source checkout path, or development-only mock capability.

- [ ] **Step 2: Verify the test fails before resource declarations are complete**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test platform_packaging`

Expected: FAIL with the first missing packaged resource.

- [ ] **Step 3: Implement the smoke verifier**

`scripts/verify-packaged-alpha.ps1` must:

1. resolve the absolute installer path;
2. verify Authenticode status or explicitly record unsigned-private-alpha status;
3. install or unpack into an isolated test directory;
4. launch with a temporary managed-project root;
5. verify the app reports desktop, credential-vault, template, Rojo, and Studio-companion capability states truthfully;
6. create and build the fixture Obby;
7. confirm no secret appears in logs/receipts;
8. stop the process and emit a JSON evidence file.

- [ ] **Step 4: Run release verification**

Run:

```powershell
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-fail-fast
npm run tauri build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-packaged-alpha.ps1
```

Expected: all commands exit `0`; the smoke evidence reports truthful capability states and no secret matches.

- [ ] **Step 5: Commit**

Commit: `git add src-tauri/tauri.conf.json scripts/verify-packaged-alpha.ps1 docs/release/private-alpha-runbook.md src-tauri/tests/platform_packaging.rs && git commit -m "build: package verified RobloxForge private alpha"`

## Platform completion evidence

The Platform lane is complete only when all focused tests pass, one real Studio proof is hash-linked to the exact built artifact, one private version is uploaded to a Steve-owned test place, owner analytics return real evidence or an explicit documented delay, the packaged Windows alpha passes the smoke verifier, and no browser/mock/failed operation can satisfy an authoritative gate.
