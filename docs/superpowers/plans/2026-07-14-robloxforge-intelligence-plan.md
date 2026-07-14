# RobloxForge Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the versioned Game Director intelligence that understands a game's intended achievement and operation, safely transforms reference-game patterns into an original Game Operating Model, monitors public monetization signals without fabricating revenue, and proposes evidence-backed improvements.

**Architecture:** JSON Schema 2020-12 is the cross-runtime contract for Game Briefs, Game Operating Models, proposals, provenance, corpus records, reference analysis, radar observations, and recommendations. Cloudflare verifies Steve and brokers OpenRouter; Rust validates both reference rights and separate AI-use authorization before ingestion, then stages, approves, persists, and hashes typed domain operations. Allowlisted public metadata evidence and private Steve-owned analytics stay in separate namespaces; owner metrics never enter the corpus, radar, or shared model context, and copy-enabled permission alone never authorizes OpenRouter, Design DNA, retrieval, or ML use.

**Tech Stack:** JSON Schema 2020-12, TypeScript, Ajv, Rust/serde, Cloudflare Workers/D1, Clerk, OpenRouter, Vitest, Cargo tests.

---

### Task 1: Define closed versioned intelligence schemas

**Files:**
- Create: `schemas/intelligence/common.schema.json`
- Create: `schemas/intelligence/game-brief.v1.schema.json`
- Create: `schemas/intelligence/game-operating-model.v1.schema.json`
- Create: `schemas/intelligence/director-proposal.v1.schema.json`
- Create: `schemas/intelligence/provenance.v1.schema.json`
- Create: `schemas/intelligence/corpus-record.v1.schema.json`
- Create: `schemas/intelligence/reference-analysis.v1.schema.json`
- Create: `schemas/intelligence/radar-snapshot.v1.schema.json`
- Create: `schemas/intelligence/monetization-opportunity-signal.v1.schema.json`
- Create: `schemas/intelligence/recommendation.v1.schema.json`
- Create: `schemas/intelligence/fixtures/valid/obby.json`
- Create: `schemas/intelligence/fixtures/invalid/competitor-revenue.json`
- Create: `schemas/intelligence/fixtures/invalid/unverified-reference-url.json`
- Create: `schemas/intelligence/fixtures/invalid/copy-enabled-ai-context-without-ai-rights.json`
- Test: `tests/contracts/intelligence-schemas.test.ts`

- [ ] **Step 1: Write failing schema-conformance tests**

```ts
it("accepts the valid Obby contract set", () => {
  expect(validateFixture("valid/obby.json")).toEqual([]);
});

it("rejects unknown competitor revenue estimates", () => {
  const errors = validateFixture("invalid/competitor-revenue.json");
  expect(errors.some((error) => error.includes("estimatedRevenue"))).toBe(true);
});

it("rejects arbitrary filesystem commands", () => {
  const proposal = validProposal({ operation: { type: "write_file", path: "C:/x" } });
  expect(validate("director-proposal.v1", proposal).valid).toBe(false);
});

it("rejects a reference before rights policy allows ingestion", () => {
  const errors = validateFixture("invalid/unverified-reference-url.json");
  expect(errors.some((error) => error.includes("rightsBasis"))).toBe(true);
  expect(errors.some((error) => error.includes("policyDecision"))).toBe(true);
});

it("rejects copy-enabled permission as AI-use authority", () => {
  const errors = validateFixture("invalid/copy-enabled-ai-context-without-ai-rights.json");
  expect(errors.some((error) => error.includes("aiUseAuthorization"))).toBe(true);
  expect(errors.some((error) => error.includes("aiUseEvidenceRef"))).toBe(true);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm run test:run -- tests/contracts/intelligence-schemas.test.ts`

Expected: FAIL because schemas and the validator do not exist.

- [ ] **Step 3: Implement strict schemas**

Every object uses `"additionalProperties": false`. The proposal operation union is limited to semantic operations:

```json
{
  "oneOf": [
    { "$ref": "#/$defs/briefSetField" },
    { "$ref": "#/$defs/questionAnswer" },
    { "$ref": "#/$defs/sceneAdd" },
    { "$ref": "#/$defs/sceneUpdate" },
    { "$ref": "#/$defs/sceneRemove" },
    { "$ref": "#/$defs/objectiveAdd" },
    { "$ref": "#/$defs/objectiveUpdate" },
    { "$ref": "#/$defs/objectiveRemove" },
    { "$ref": "#/$defs/progressionUpdate" },
    { "$ref": "#/$defs/economyUpdate" },
    { "$ref": "#/$defs/runtimeRuleUpdate" },
    { "$ref": "#/$defs/feedbackUpdate" },
    { "$ref": "#/$defs/acceptanceTestUpdate" }
  ]
}
```

Every operation has one stable dot-qualified `type` matching the definitions above, a typed target ID, `before`/precondition data, `after` data, rationale, GOM trace, risk, affected acceptance-test IDs, and generated inverse data. No proposal schema permits host paths, shell text, credentials, arbitrary commands, or unbounded source content. Every reference/corpus source requires the exact closed fields `sourceKind`, `rightsBasis`, `rightsEvidenceRef`, `policyDecision`, `aiUseAuthorization`, and `aiUseEvidenceRef` with these values:

```ts
type ReferenceSourceKind =
  | "owner_authored"
  | "licensed_template"
  | "copy_enabled_template"
  | "public_metadata"
  | "user_authored_abstract";
type ReferenceRightsBasis =
  | "owned"
  | "expressly_licensed"
  | "copy_enabled"
  | "public_metadata_only"
  | "user_authored";
type ReferencePolicyDecision = "allowed" | "needs_review" | "blocked";
type ReferenceAiUseAuthorization =
  | "owner_authorized"
  | "expressly_ai_licensed"
  | "user_authored"
  | "public_metadata_only"
  | "not_authorized";
type ReferenceAiUseEvidenceRef = string | null;
```

`rightsEvidenceRef` is required for every source and points to the immutable acquisition/provenance record. `aiUseEvidenceRef` is `null` only with `aiUseAuthorization: "not_authorized"`; every other AI-use state requires an immutable evidence record for that exact authorization. Only `policyDecision: "allowed"` plus `owner_authorized | expressly_ai_licensed | user_authored | public_metadata_only` may enter retrieval, Design DNA, OpenRouter context, or any ML operation. `rightsBasis: "copy_enabled"` alone always maps to `aiUseAuthorization: "not_authorized"`: it permits an optional manual template import only after included-asset rights checks. Copy-enabled content may enter AI only when a separate express AI-use license is recorded in `aiUseEvidenceRef` and the state is `expressly_ai_licensed`. A URL without both gates is an inert identifier: it cannot trigger fetching, gameplay observation, asset/script/UI extraction, or Design DNA generation. The GOM requires schema/generator/knowledge versions, revision/hash, provenance, loops, objectives, runtime rules, scene/system trace, mobile/performance budgets, monetization safety, analytics, and acceptance tests.

- [ ] **Step 4: Run and commit**

Run: `npm run test:run -- tests/contracts/intelligence-schemas.test.ts`

Expected: PASS for every valid fixture and PASS for each targeted rejection.

Commit: `git add schemas/intelligence tests/contracts/intelligence-schemas.test.ts && git commit -m "feat: define closed game intelligence contracts"`

### Task 2: Add TypeScript and Rust contract adapters

**Files:**
- Create: `src/intelligence/contracts.ts`
- Create: `src/intelligence/validation.ts`
- Create: `src-tauri/src/intelligence/mod.rs`
- Create: `src-tauri/src/intelligence/contracts.rs`
- Create: `src-tauri/src/intelligence/validation.rs`
- Create: `src-tauri/src/intelligence/canonical_json.rs`
- Test: `src-tauri/tests/intelligence_contracts.rs`

- [ ] **Step 1: Write cross-runtime fixture tests**

```rust
#[test]
fn canonical_hash_is_stable_across_key_order() {
    let a = serde_json::json!({"schemaVersion":"1.0.0","revision":1,"title":"Obby"});
    let b = serde_json::json!({"title":"Obby","revision":1,"schemaVersion":"1.0.0"});
    assert_eq!(canonical_sha256(&a).unwrap(), canonical_sha256(&b).unwrap());
}

#[test]
fn future_major_schema_fails_closed() {
    let fixture = fixture_with_schema_version("2.0.0");
    assert!(validate_game_operating_model(&fixture).is_err());
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test intelligence_contracts`

Expected: FAIL because contract adapters are absent.

- [ ] **Step 3: Implement one canonical validator/hash path**

TypeScript and Rust load the committed schemas and expose typed validation results. Rust canonicalizes JSON recursively, hashes UTF-8 bytes with SHA-256, rejects unsupported major versions, and runs an explicit idempotent migration registry for supported minor revisions.

- [ ] **Step 4: Run and commit**

Run:

```powershell
npm run test:run -- tests/contracts/intelligence-schemas.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --test intelligence_contracts
```

Expected: both runtimes agree on every valid/invalid fixture.

Commit: `git add src/intelligence src-tauri/src/intelligence src-tauri/tests/intelligence_contracts.rs && git commit -m "feat: validate intelligence contracts across runtimes"`

### Task 3: Implement Game Brief and Game Operating Model lifecycles

**Files:**
- Create: `src-tauri/src/intelligence/brief.rs`
- Create: `src-tauri/src/intelligence/operating_model.rs`
- Create: `src-tauri/src/intelligence/invariants.rs`
- Test: `src-tauri/tests/game_brief.rs`
- Test: `src-tauri/tests/game_operating_model.rs`
- Test: `src-tauri/tests/operating_model_invariants.rs`

- [ ] **Step 1: Write lifecycle/invariant failures first**

```rust
#[test]
fn unresolved_material_question_blocks_approval() {
    let brief = fixture_brief_with_material_question();
    assert!(brief.approve().is_err());
}

#[test]
fn objective_graph_requires_reachable_final_achievement() {
    let gom = fixture_gom_with_orphan_final_objective();
    assert!(validate_invariants(&gom).iter().any(|i| i.code == "objective.final_unreachable"));
}

#[test]
fn every_acceptance_test_traces_to_a_requirement() {
    let gom = fixture_gom_with_untraced_test();
    assert!(validate_invariants(&gom).iter().any(|i| i.code == "acceptance.untraced"));
}
```

- [ ] **Step 2: Run and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test game_brief --test game_operating_model --test operating_model_invariants`

Expected: FAIL because lifecycle services are absent.

- [ ] **Step 3: Implement explicit states and invariants**

Game Brief states are `draft | needs_answers | valid | approved`. GOM states are `candidate | invalid | pending_approval | approved | superseded`. Semantic change increments revision and hash; presentation-only state does not. Validate graph references, state transitions, currency source/sink declarations, recovery proportionality, mobile controls, performance budgets, monetization value/fairness/child-safety, and acceptance-test traceability.

- [ ] **Step 4: Run and commit**

Run the focused Cargo tests.

Expected: PASS.

Commit: `git add src-tauri/src/intelligence src-tauri/tests/game_brief.rs src-tauri/tests/game_operating_model.rs src-tauri/tests/operating_model_invariants.rs && git commit -m "feat: model game intent and operation explicitly"`

### Task 4: Build the rights-approved cited game-intelligence corpus

**Files:**
- Create: `data/intelligence/corpus/manifest.v1.json`
- Create: `data/intelligence/corpus/records/*.json`
- Create: `data/intelligence/provenance/sources/*.json`
- Create: `src-tauri/src/intelligence/corpus.rs`
- Create: `src-tauri/src/intelligence/provenance.rs`
- Create: `src-tauri/src/intelligence/retrieval.rs`
- Test: `src-tauri/tests/corpus_manifest.rs`
- Test: `src-tauri/tests/intelligence_retrieval.rs`

- [ ] **Step 1: Write tamper, citation, and diversity tests**

```rust
#[test]
fn modified_record_breaks_manifest_hash() {
    let mut pack = fixture_pack();
    pack.tamper_record("ai-licensed-obby-template");
    assert!(pack.verify().is_err());
}

#[test]
fn retrieval_requires_cited_diverse_evidence() {
    let results = fixture_index().retrieve(&Query::genre("obby").minimum_distinct_sources(3)).unwrap();
    assert!(results.iter().all(|r| !r.evidence_refs.is_empty()));
    assert!(distinct_source_count(&results) >= 3);
}

#[test]
fn retrieval_rejects_unallowed_reference_before_content_ingestion() {
    let result = fixture_index().ingest(unverified_game_url_record());
    assert!(matches!(result, Err(CorpusError::RightsPolicyBlocked)));
}

#[test]
fn retrieval_rejects_copy_enabled_only_content() {
    let result = fixture_index().ingest(copy_enabled_without_ai_license());
    assert!(matches!(result, Err(CorpusError::AiUseNotAuthorized)));
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test corpus_manifest --test intelligence_retrieval`

Expected: FAIL before corpus services exist.

- [ ] **Step 3: Encode only rights-approved studies**

Treat rights review as a private-alpha release gate. Do not migrate any of the proposed 36 studies until its provenance record has an allowed `sourceKind`, matching `rightsBasis`, immutable `rightsEvidenceRef`, allowed `policyDecision`, permitted `aiUseAuthorization`, and non-null `aiUseEvidenceRef`. Start content-bearing AI fixtures only with Steve-owned or expressly AI-licensed material and compliant acquisition provenance; public-metadata records may contain only allowlisted public metadata, and user-authored-abstract records may contain only Steve's own description. Copy-enabled-only templates remain outside the corpus and are available solely to the asset-checked manual-template pathway; copying permission is not AI permission. Store observation date, sources, confidence, conflicts, permitted stable/volatile fields, reusable abstract patterns, genre-specific patterns, public monetization signals, mobile implications, and anti-patterns. Do not access or store third-party gameplay, maps, code, assets, scripts, names, characters, branded UI, distinctive abilities, audio, or uncited revenue claims for AI use. Roblox's current [Terms of Use](https://en.help.roblox.com/hc/en-us/articles/115004647846-Roblox-Terms-of-Use) restrict using Roblox Virtual Content with ML/AI; Roblox's [copying controls](https://en.help.roblox.com/hc/en-us/articles/203313940-Disallow-Copying-of-Your-Experience) establish copying state only, never AI-use authorization. Generate manifest hashes deterministically.

- [ ] **Step 4: Implement deterministic retrieval**

Filter to `policyDecision: "allowed"` and an AI-authorized state before ranking by genre/loop/pattern/device fit, evidence confidence, freshness, and source diversity. Return bounded records with citations, acquisition provenance, and AI-use evidence. Stale volatile fields remain visible as stale rather than silently refreshed; no retrieval path can bypass either pre-ingestion gate.

- [ ] **Step 5: Run and commit**

Run the focused corpus tests.

Expected: PASS, with tampering rejected and deterministic tie-breaking.

Commit: `git add data/intelligence src-tauri/src/intelligence src-tauri/tests/corpus_manifest.rs src-tauri/tests/intelligence_retrieval.rs && git commit -m "feat: add cited Roblox game intelligence corpus"`

### Task 5: Gate reference rights before deconstruction and enforce originality

**Files:**
- Create: `src-tauri/src/intelligence/reference/mod.rs`
- Create: `src-tauri/src/intelligence/reference/deconstruct.rs`
- Create: `src-tauri/src/intelligence/reference/transform.rs`
- Create: `src-tauri/src/intelligence/reference/originality.rs`
- Create: `src-tauri/src/intelligence/reference/ip_risk.rs`
- Test: `src-tauri/tests/reference_deconstruction.rs`
- Test: `src-tauri/tests/originality_transform.rs`

- [ ] **Step 1: Write blocked-clone and transformed-pattern tests**

```rust
#[test]
fn cosmetic_reskin_of_one_reference_is_blocked() {
    let result = originality_review(single_reference_reskin());
    assert_eq!(result.verdict, OriginalityVerdict::Blocked);
}

#[test]
fn unlicensed_game_url_is_blocked_before_deconstruction() {
    let result = deconstruct_reference(unverified_game_url());
    assert!(matches!(result, Err(ReferenceError::RightsPolicyBlocked)));
    assert_eq!(reference_fetch_count(), 0);
}

#[test]
fn copy_enabled_without_express_ai_license_is_never_deconstructed() {
    let result = deconstruct_reference(copy_enabled_only_template());
    assert!(matches!(result, Err(ReferenceError::AiUseNotAuthorized)));
    assert_eq!(reference_fetch_count(), 0);
}

#[test]
fn transformed_ai_licensed_multi_reference_design_passes() {
    let result = originality_review(original_ai_licensed_obby_horror_hybrid());
    assert_eq!(result.verdict, OriginalityVerdict::Pass);
    assert!(result.corroborating_corpus_ids.len() >= 3);
    assert!(!result.material_mechanical_differences.is_empty());
}
```

- [ ] **Step 2: Run and verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test reference_deconstruction --test originality_transform`

Expected: FAIL before reference services exist.

- [ ] **Step 3: Implement the reference pipeline**

Validate `sourceKind`, `rightsBasis`, `rightsEvidenceRef`, `policyDecision`, `aiUseAuthorization`, and `aiUseEvidenceRef` before resolving or fetching anything. An arbitrary Roblox game URL remains inert and returns `blocked`; originality transformation never cures unauthorized input. For an allowed Steve-owned, expressly AI-licensed, public-metadata-only, or user-authored-abstract source, ingest only the content permitted by both rights gates, record Steve-selected admired abstract traits, corroborate them against AI-authorized corpus records, and transform theme/narrative/characters/names/space/assets/audio/UI/rewards/distinctive abilities. A copy-enabled-only template can be imported manually after per-asset rights checks but cannot be deconstructed, summarized, embedded, sent to OpenRouter, or used for Design DNA/ML; a separate express AI-use license and `aiUseEvidenceRef` are required to change that state. Require one material mechanical/progression difference for every expressly AI-licensed or manual-template output, and return `pass | needs_review | blocked` with reasons and both evidence references.

- [ ] **Step 4: Run and commit**

Run focused tests.

Expected: PASS; unallowed URLs cause zero fetches, and recognizable names/assets/signature abilities or cosmetic-only changes block even when the source itself is permitted.

Commit: `git add src-tauri/src/intelligence/reference src-tauri/tests/reference_deconstruction.rs src-tauri/tests/originality_transform.rs && git commit -m "feat: transform reference games into original designs"`

### Task 6: Implement the public Monetization Radar

**Files:**
- Create: `workers/game-director/src/intelligence/radar/types.ts`
- Create: `workers/game-director/src/intelligence/radar/normalize.ts`
- Create: `workers/game-director/src/intelligence/radar/features.ts`
- Create: `workers/game-director/src/intelligence/radar/score.ts`
- Create: `workers/game-director/src/intelligence/radar/refresh.ts`
- Create: `workers/game-director/migrations/0001_intelligence_provenance.sql`
- Create: `workers/game-director/migrations/0002_radar_snapshots_scores.sql`
- Test: `workers/game-director/test/radar-score.test.ts`

- [ ] **Step 1: Write missingness and uncertainty tests**

```ts
it("shrinks low-confidence opportunity signals toward neutral", () => {
  const result = scoreMos({ raw: 90, confidence: 0.2 });
  expect(result.adjusted).toBe(58);
  expect(result.uncertainty).toBe(21);
});

it("does not convert rank or CCU into revenue", () => {
  const result = scoreSnapshot(fixtureSnapshot());
  expect(result).not.toHaveProperty("revenueEstimate");
});

it("keeps missing rank missing", () => {
  expect(scoreSnapshot(noRankSnapshot()).modelVersion).toBe("MOS-public-no-rank-v1");
});

it("rejects non-allowlisted content and private owner analytics", () => {
  expect(() => normalizeSnapshot(gameplayContentSnapshot())).toThrow("source_not_allowlisted");
  expect(() => normalizeSnapshot(ownerAnalyticsSnapshot())).toThrow("private_owner_evidence_forbidden");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npm --prefix worker test -- radar-score.test.ts`

Expected: FAIL because Radar modules are absent.

- [ ] **Step 3: Implement normalization/features/scoring**

Allow only timestamped public signals from an explicit source allowlist: official Roblox public discovery/experience metadata, public rank/CCU/visit counters, publicly advertised item/pass prices, and public update/event metadata. Never fetch or analyze gameplay, maps, assets, scripts, UI, audio, or other Virtual Content; never admit private owner Analytics Query data or confidential Creator Analytics benchmarks. Score public momentum at 30 points, observed rank evidence at 20, public price/catalog signals at 25, public update/event cadence at 15, and build/originality/mobile/safety fit at 10. Confidence is `.35*sourceCoverage + .25*sampleDuration + .20*rankEvidence + .20*productObservability`; adjusted score is `50 + C*(raw-50)`; uncertainty is `5 + 20*(1-C)`. Counter resets create discontinuities, never negative velocity. Prices retain locale/account context. Do not infer competitor revenue, payer conversion, or retention from any public proxy.

- [ ] **Step 4: Run and commit**

Run: `npm --prefix worker test -- radar-score.test.ts`

Expected: PASS with no zero imputation or revenue field.

Commit: `git add workers/game-director/src/intelligence/radar workers/game-director/migrations workers/game-director/test && git commit -m "feat: score public monetization opportunities honestly"`

### Task 7: Broker the Game Director through Cloudflare/OpenRouter

**Files:**
- Create: `workers/game-director/src/intelligence/auth/clerk.ts`
- Create: `workers/game-director/src/intelligence/auth/allowlist.ts`
- Create: `workers/game-director/src/intelligence/director/router.ts`
- Create: `workers/game-director/src/intelligence/director/context.ts`
- Create: `workers/game-director/src/intelligence/director/openrouter.ts`
- Create: `workers/game-director/src/intelligence/director/response.ts`
- Create: `workers/game-director/src/intelligence/receipts.ts`
- Create: `workers/game-director/src/routes/director.ts`
- Create: `src-tauri/src/ai/director_client.rs`
- Create: `src-tauri/src/ai/proposal.rs`
- Test: `workers/game-director/test/director-contract.test.ts`
- Test: `src-tauri/tests/director_round_trip.rs`

- [ ] **Step 1: Write auth, redaction, and no-mutation failure tests**

```ts
it("rejects a non-allowlisted Clerk identity", async () => {
  expect((await requestDirector({ identity: "not-steve" })).status).toBe(403);
});

it("never logs model or Roblox credentials", async () => {
  const logs = await runWithSentinelSecrets();
  expect(logs).not.toContain("sentinel-openrouter-secret");
  expect(logs).not.toContain("sentinel-roblox-secret");
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
npm --prefix worker test -- director-contract.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --test director_round_trip
```

Expected: FAIL because broker/proposal services are absent.

- [ ] **Step 3: Implement typed request/response flow**

Worker verifies Clerk and Steve allowlist, selects a configured task tier, filters every context record through both the rights decision and AI-use authorization, builds bounded citation-bearing context, calls one hardened OpenRouter client, validates the exact target schema, redacts errors, and returns an immutable provider receipt. Copy-enabled-only records never cross the broker boundary. Rust validates again, stages the proposal, compares project/base revision/hash on approval, applies transactionally, and records the resulting hash. Provider timeout, malformed output, rejection, cancellation, or stale base leaves project state unchanged.

- [ ] **Step 4: Run and commit**

Run the Worker and Rust focused tests.

Expected: PASS; no Worker route accepts Roblox credentials and no response directly mutates files.

Commit: `git add workers/game-director/src/intelligence workers/game-director/src/routes workers/game-director/test src-tauri/src/ai src-tauri/tests/director_round_trip.rs && git commit -m "feat: broker typed Game Director proposals"`

### Task 8: Join evidence and emit one bounded recommendation

**Files:**
- Create: `src-tauri/src/intelligence/evidence.rs`
- Create: `src-tauri/src/intelligence/recommendation.rs`
- Create: `src/intelligence/recommendations.ts`
- Test: `src-tauri/tests/evidence_boundary.rs`
- Test: `src-tauri/tests/intelligence_recommendation.rs`
- Test: `tests/intelligence/reference-to-gom.test.ts`

- [ ] **Step 1: Write evidence-boundary tests**

```rust
#[test]
fn public_evidence_cannot_populate_exact_revenue() {
    let evidence = PublicRadarEvidence::fixture();
    assert!(OwnerMetric::try_from(evidence).is_err());
}

#[test]
fn recommendation_requires_trace_metric_and_rollback() {
    let invalid = Recommendation::fixture_without_rollback();
    assert!(invalid.validate().is_err());
}
```

- [ ] **Step 2: Verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test evidence_boundary --test intelligence_recommendation`

Expected: FAIL because evidence/recommendation services are absent.

- [ ] **Step 3: Implement separated evidence namespaces**

A recommendation cites a GOM path, public/owner evidence IDs, predicted direction, risk, one acceptance metric, one rollback condition, and exactly one bounded change. Public evidence cannot populate revenue/payer/retention fields. Owner evidence requires `universe.analytics:read`, authorized-universe and place-version correlation, and preserves Roblox point status as `valid | projected | not_statistically_significant`; missing stays absent rather than zero. Network/no-data remains unknown. Private owner metrics and Creator Analytics benchmarking data may evaluate Steve's own experience only and can never populate the public radar, corpus, shared model context/training, or cross-experience/customer benchmark output.

- [ ] **Step 4: Run end-to-end intelligence tests and commit**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test evidence_boundary --test intelligence_recommendation
npm run test:run -- tests/intelligence/reference-to-gom.test.ts
```

Expected: a Steve-owned or expressly AI-licensed reference with compliant acquisition and AI-use provenance produces cited Design DNA and an original valid GOM candidate; bounded public metadata and Steve-authored abstracts remain permitted, copy-enabled-only input produces no AI context, and owner/public evidence produces one bounded recommendation without competitor revenue claims.

Commit: `git add src-tauri/src/intelligence src-tauri/tests src/intelligence tests/intelligence && git commit -m "feat: recommend evidence-backed game improvements"`
