import { isTauriRuntime } from "../lib/isTauriRuntime";

export function DevModeBanner() {
  if (import.meta.env.PROD || isTauriRuntime()) {
    return null;
  }

  return (
    <div className="shrink-0 border-b border-amber-900/60 bg-amber-950/90 px-4 py-2 text-center text-sm text-amber-100">
      Browser dev mode: UI-only mock backend. For real projects and AI, install Rust and
      run{" "}
      <code className="rounded bg-amber-900/50 px-1">npm run tauri dev</code>.
    </div>
  );
}
