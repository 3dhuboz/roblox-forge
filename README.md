# RobloxForge

**AI-Powered Roblox Game Builder** — Build amazing Roblox games with AI assistance. No Studio required.

RobloxForge lets anyone aged 14–50 design, build, and publish Roblox games through an AI chat interface. Pick a game template, describe what you want in plain English, and the AI generates the Luau scripts, game layout, and configuration. Validate, then publish directly to Roblox via the Open Cloud API.

## Features

- **3 Game Templates** — Obby (obstacle course), Tycoon (factory builder), Simulator (click-to-earn + pets)
- **AI Game Builder** — Chat with AI to design your game. It generates Luau scripts and game structure in real time
- **Guided Wizard** — Step-by-step builder for beginners: pick theme, difficulty, features, and generate
- **Luau Script Editor** — Built-in editor with syntax highlighting for keywords, builtins, strings, comments
- **Visual Stage Map** — Top-down 2D preview of your game layout with interactive hover tooltips
- **Instance Tree View** — Full Roblox hierarchy explorer (DataModel → Workspace → Parts)
- **Pre-Publish Validation** — 8 automated checks: spawn points, stage gaps, checkpoints, script errors, part count
- **Roblox OAuth 2.0** — PKCE auth flow to connect your Roblox account
- **One-Click Publish** — Upload .rbxl place files via Open Cloud API
- **Dashboard** — Track visits, active players, favorites, and estimated Robux earnings
- **Adaptive UX** — Beginner/Intermediate/Advanced modes with different AI personalities and UI complexity
- **Recent Projects** — Quick resume with localStorage-persisted project history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | [Tauri v2](https://tauri.app/) (Rust + WebView) |
| Frontend | React 19, TypeScript, TailwindCSS v4, Zustand, React Router v7 |
| Icons | Lucide React |
| AI | Claude API (Anthropic) |
| Auth | Roblox OAuth 2.0 PKCE |
| Publishing | Roblox Open Cloud REST API |
| Build System | [Rojo](https://rojo.space/) (project.json + .model.json) |

## Quick Start

### Browser Preview (no Rust needed)

```bash
npm install
npm run dev
```

Opens at `http://localhost:1420` with a mock backend. All UI features work — AI chat returns simulated responses, the script editor shows real Luau code, and the stage map renders with sample data.

### Full Desktop App (requires Rust)

```bash
# Install Rust
winget install Rustlang.Rustup   # Windows
# or: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # macOS/Linux

# Install Rojo (for building .rbxl files)
aftman install

# Run the app
npm install
npm run tauri dev
```

### Configuration

1. **Claude API Key** — Go to Settings → paste your key from [console.anthropic.com](https://console.anthropic.com)
2. **Roblox OAuth** — Go to Publish → Connect Roblox Account (requires a [Roblox OAuth app](https://create.roblox.com/credentials))

## Project Structure

```
roblox-forge/
├── src/                          # React frontend
│   ├── components/               # Layout, shared components
│   ├── features/                 # Feature modules
│   │   ├── build/                # BuildPage, GuidedWizard, ScriptEditor
│   │   ├── chat/                 # ChatPanel, SmartSuggestions
│   │   ├── dashboard/            # Analytics dashboard
│   │   ├── onboarding/           # First-launch onboarding flow
│   │   ├── preview/              # GamePreview, StageMapView
│   │   ├── publish/              # Publish wizard
│   │   ├── settings/             # Settings page
│   │   ├── templates/            # Template selector
│   │   └── validation/           # Validation panel
│   ├── lib/                      # Utilities (Luau highlighter, Tauri detection)
│   ├── services/                 # Tauri command wrappers + browser mocks
│   ├── stores/                   # Zustand state (user, project, chat, auth)
│   └── types/                    # TypeScript type definitions
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── ai/                   # Claude API client, prompt builder, command parser
│       ├── builder/              # Rojo build pipeline
│       ├── commands/             # Tauri command handlers
│       ├── project/              # Project manager (create, read hierarchy, write files)
│       ├── roblox/               # OAuth 2.0 + Open Cloud API
│       └── validation/           # 8 pre-publish validation checks
├── templates/                    # Game templates (Rojo format)
│   ├── obby/                     # Obstacle course (6 Luau scripts, 4 model JSONs)
│   ├── tycoon/                   # Factory tycoon (5 Luau scripts, 3 model JSONs)
│   └── simulator/                # Click simulator (5 Luau scripts, 3 model JSONs)
└── package.json
```

## Templates

### Obby
Obstacle course with stages, checkpoints, kill bricks, and data persistence. Scripts: StageManager, DataManager, LeaderboardManager, ObbyUI, ObbyConfig.

### Tycoon
Factory builder with droppers, conveyors, collectors, upgrade buttons, and income management. Scripts: TycoonManager, IncomeManager, DataManager, TycoonUI, TycoonConfig.

### Simulator
Click-to-earn game with pet hatching, rebirth system, zone unlocks, and progression. Scripts: ClickManager, PetManager, RebirthManager, DataManager, SimulatorUI, SimConfig.

## Roadmap

- [ ] Install Rust and verify full Tauri desktop build
- [ ] More templates: Battlegrounds, RPG, Horror, Racing, Minigames
- [ ] 3D game preview using Three.js or Babylon.js
- [ ] Real-time Roblox analytics from Creator Dashboard
- [ ] Collaborative building (multiple users on one project)
- [ ] Asset marketplace integration
- [ ] Mobile companion app

## License

MIT
