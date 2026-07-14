import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ValidationIssue, Severity } from "../../types/validation";
import {
  useProjectStore,
  type ValidationState,
} from "../../stores/projectStore";

interface ValidationPanelProps {
  issues: ValidationIssue[];
  state: ValidationState;
  error: string | null;
}

const severityConfig: Record<
  Severity,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  error: { icon: XCircle, color: "text-red-400", bgColor: "bg-red-950/30" },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bgColor: "bg-yellow-950/30",
  },
  info: { icon: Info, color: "text-blue-400", bgColor: "bg-blue-950/30" },
};

const stateConfig: Record<
  ValidationState,
  { icon: LucideIcon; title: string; color: string }
> = {
  not_run: {
    icon: Info,
    title: "Validation Not Run",
    color: "text-gray-400",
  },
  running: {
    icon: Loader2,
    title: "Validation Running",
    color: "text-indigo-400",
  },
  failed: {
    icon: XCircle,
    title: "Validation Failed",
    color: "text-red-400",
  },
  passed: {
    icon: CheckCircle,
    title: "Validation Passed",
    color: "text-green-400",
  },
};

export function ValidationPanel({
  issues,
  state,
  error,
}: ValidationPanelProps) {
  const { autoFixIssue, fixingIssueId } = useProjectStore();
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const status = stateConfig[state];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center gap-3">
        <StatusIcon
          size={24}
          className={`${status.color} ${state === "running" ? "animate-spin" : ""}`}
        />
        <div>
          <h3 className="text-lg font-semibold">{status.title}</h3>
          <p className="text-sm text-gray-400">
            {state === "not_run"
              ? "Run validation before publishing."
              : state === "running"
                ? "Checking project files and game rules..."
                : `${errors.length} errors, ${warnings.length} warnings`}
          </p>
        </div>
      </div>

      {state === "failed" && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
        >
          {error ?? "Validation did not pass. Resolve the issues before publishing."}
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-4 space-y-2">
          {issues.map((issue) => {
            const config = severityConfig[issue.severity];
            const Icon = config.icon;
            const isFixing = fixingIssueId === issue.id;
            return (
              <div
                key={issue.id}
                className={`flex items-start gap-3 rounded-lg ${config.bgColor} p-3`}
              >
                <Icon size={16} className={`mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1">
                  <p className="text-sm text-gray-200">{issue.message}</p>
                  {issue.location && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {issue.location}
                    </p>
                  )}
                  {issue.autoFixable && issue.fixDescription && (
                    <button
                      onClick={() => autoFixIssue(issue.id)}
                      disabled={fixingIssueId !== null}
                      className="mt-1.5 flex items-center gap-1.5 rounded bg-gray-800 px-2.5 py-1 text-xs text-indigo-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFixing ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Fixing...
                        </>
                      ) : (
                        <>Auto-fix: {issue.fixDescription}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state === "passed" && (
        <p className="mt-3 text-sm text-gray-400">
          All checks passed. Your game is ready to publish!
        </p>
      )}
    </div>
  );
}
