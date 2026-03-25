import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore } from "../stores/toastStore";
import type { ToastType } from "../stores/toastStore";

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: "border-green-800/60 bg-green-950/80 text-green-200",
  error: "border-red-800/60 bg-red-950/80 text-red-200",
  warning: "border-amber-800/60 bg-amber-950/80 text-amber-200",
  info: "border-indigo-800/60 bg-indigo-950/80 text-indigo-200",
};

const iconColorMap: Record<ToastType, string> = {
  success: "text-green-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-indigo-400",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm animate-in slide-in-from-right ${colorMap[toast.type]}`}
            style={{ minWidth: 280, maxWidth: 400 }}
          >
            <Icon size={18} className={`mt-0.5 shrink-0 ${iconColorMap[toast.type]}`} />
            <p className="flex-1 text-sm leading-relaxed">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
