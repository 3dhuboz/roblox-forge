import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        // Only allow Ctrl+S in textareas (handled by ScriptEditor)
        if (e.key !== "s") return;
        return;
      }

      switch (e.key) {
        case "1":
          e.preventDefault();
          navigate("/");
          break;
        case "2":
          e.preventDefault();
          navigate("/build");
          break;
        case "3":
          e.preventDefault();
          navigate("/publish");
          break;
        case "4":
          e.preventDefault();
          navigate("/dashboard");
          break;
        case "5":
          e.preventDefault();
          navigate("/settings");
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, location]);
}
