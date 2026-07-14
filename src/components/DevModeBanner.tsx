import { isTauriRuntime } from "../lib/isTauriRuntime";

export function DevModeBanner() {
  if (isTauriRuntime()) return null;

  return (
    <div
      role="status"
      aria-label="Browser preview mode"
      className="border-b border-amber-400/30 bg-amber-950/80 px-4 py-2 text-center text-xs text-amber-100"
    >
      <strong className="font-semibold">Browser preview:</strong>{" "}
      Projects are in-memory and temporary. Build, publish, and Roblox analytics
      require RobloxForge Desktop.
    </div>
  );
}
