# Optional Studio Sync Design

Date: 2026-07-15
Status: Approved by Steve on 2026-07-15

## Problem

RobloxForge currently presents Rojo as a required setup item. The home Getting Started checklist waits for Rojo to be installed before setup can complete, and Settings presents a missing Rojo executable as a warning. That contradicts the product goal: a beginner should create, preview, publish, and monitor a Roblox game without first assembling the same professional toolchain RobloxForge is intended to simplify.

Rojo is a useful bridge for advanced users who deliberately want live filesystem synchronization into Roblox Studio. It is not part of RobloxForge's normal authoring, direct Open Cloud publishing, or owned-analytics path.

## Product Rule

| Task | Roblox Studio | Rojo |
| --- | --- | --- |
| Create and edit in RobloxForge | Not required | Not required |
| Preview in RobloxForge | Not required | Not required |
| Publish to a verified existing Roblox place | Not required | Not required |
| Monitor owned analytics | Not required | Not required |
| Test with the Roblox engine | Optional | Not required |
| Live-sync project files into Studio | Required | Required |
| Create the first Roblox experience and start place | One-time Roblox platform prerequisite | Not required |

Normal product readiness must never depend on Rojo state.

## Approaches Considered

### 1. Optional advanced integration — selected

Keep the existing Rojo commands for users who want live Studio sync, but remove Rojo from onboarding and make its Settings surface collapsed, neutral, and explicitly optional. Do not probe for Rojo until the user opens the advanced section.

This preserves a useful expert workflow without adding work or warnings for beginners.

### 2. Bundle Rojo with RobloxForge

Ship a versioned Rojo sidecar and manage upgrades inside RobloxForge. This would remove the separate CLI install but would still require the Studio plugin and Studio itself for live sync. It also adds packaging, licensing, version compatibility, and updater work that does not improve the normal direct-publish flow.

This is deferred unless advanced sync becomes a validated high-use feature.

### 3. Remove Rojo completely

Delete the Rojo UI and commands. This is the simplest product, but it unnecessarily removes an escape hatch for experienced Roblox developers.

This is rejected while the optional integration can remain isolated safely.

## User Experience

### Getting Started

The required checklist contains only:

1. Configure the selected intelligence provider when required.
2. Create the first RobloxForge project.

It must not display an Install Rojo task, call the Rojo status command, or wait for Rojo before disappearing. The progress indicator changes from three required items to two.

### Settings

The existing Rojo card becomes **Advanced Studio Sync** with a visible **Optional** badge and this promise near the heading:

> Not needed to create, preview, publish, or monitor your game. Open this only if you want live synchronization with Roblox Studio.

The section is collapsed by default. While collapsed, it performs no Rojo command and renders no missing-tool warning.

When expanded:

- Browser preview explains neutrally that advanced sync can only be managed in RobloxForge Desktop.
- Desktop checks Rojo status once for the current expansion.
- Missing Rojo is an informational optional state, not a setup error.
- An installed Rojo retains the existing Start Sync and Stop controls.
- Failures after an explicit refresh, start, or stop action remain visible and recoverable inside this optional section.

### Build and Publish

Export remains a RobloxForge operation. **Test in Studio** remains an optional post-export action and must not gate publishing. Publish continues to use the verified owned-target Open Cloud authority and must never inspect Rojo state.

## Technical Boundaries

- `TemplateSelector` removes its Rojo checklist state, status effect, command call, and required item.
- `SettingsPage` retains the Rojo command client but moves status loading behind explicit expansion.
- Existing Tauri Rojo commands remain available; this change needs no Rust authority or publishing changes.
- Browser preview makes zero Rojo calls.
- No installer, shell command, or automatic Rojo download is added.
- No Rojo state is persisted as product readiness.

## Error Handling

- Collapsed optional sync has no error state.
- Browser runtime unavailability is explanatory, not alarming.
- A missing Rojo executable is neutral and includes installation details only after the user deliberately expands the section.
- Stale responses after collapse, runtime loss, or a newer action must not change visible state.
- Existing start/stop immediate in-flight guards remain intact.

## Tests

Test-first coverage must prove:

1. The Getting Started checklist has two required items and never renders Install Rojo.
2. A configured provider plus an existing project completes onboarding even when Rojo is missing.
3. The home route makes no Rojo status call in browser or desktop mode.
4. Settings renders Advanced Studio Sync as collapsed and optional.
5. Collapsed Settings makes no Rojo status call.
6. Expanding in browser shows a neutral Desktop explanation without calling Rojo.
7. Expanding in Desktop performs the first status check.
8. Missing Rojo is rendered as optional information, not an alert that blocks setup.
9. Installed Rojo start, stop, refresh, stale-response, runtime-loss, and unmount protections continue to pass.
10. Publish tests continue to prove that publishing depends only on verified target authority and project validation.

## Acceptance Criteria

- A new user can complete onboarding without Rojo.
- No normal create, build, publish, or analytics page claims Rojo is required.
- No Rojo process check occurs until Advanced Studio Sync is opened in Desktop.
- Advanced users can still start and stop Rojo sync after opting in.
- Focused tests, full frontend tests, typecheck, production build, desktop package build, and live browser QA pass.

## Out of Scope

- Bundling or automatically installing Rojo.
- Replacing the Roblox engine for engine-accurate playtesting.
- Circumventing Roblox's supported first-experience creation workflow.
- Changing the secure Open Cloud publishing or analytics authority.
