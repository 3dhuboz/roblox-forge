/** True when the app is running inside the Tauri desktop shell (not plain Vite / browser). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
