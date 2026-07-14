import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Boxes, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  generateApprovedDirectorSceneProposal,
  type ApprovedDirectorSceneApproval,
  type GuidedSceneProposal,
} from "../../intelligence/approvedDirectorScene";
import { isTauriRuntime } from "../../lib/isTauriRuntime";
import { useGameDirectorStore } from "../../stores/gameDirectorStore";
import { useGuidedSceneStore } from "../../stores/guidedSceneStore";
import { useProjectStore } from "../../stores/projectStore";

let creationAttemptSequence = 0;

function nextCreationAttemptId(proposalId: string): string {
  creationAttemptSequence += 1;
  return `${proposalId}:create:${creationAttemptSequence}`;
}

function proposalFor(
  approval: ApprovedDirectorSceneApproval,
): GuidedSceneProposal | null {
  try {
    return generateApprovedDirectorSceneProposal(approval);
  } catch {
    return null;
  }
}

export function CreateFromApprovedBrief() {
  const navigate = useNavigate();
  const draft = useGameDirectorStore((state) => state.draft);
  const draftContentBinding = useGameDirectorStore(
    (state) => state.draftContentBinding,
  );
  const approvalState = useGameDirectorStore((state) => state.approvalState);
  const approvedFingerprint = useGameDirectorStore(
    (state) => state.approvedFingerprint,
  );
  const approvedContentBinding = useGameDirectorStore(
    (state) => state.approvedContentBinding,
  );
  const createProject = useProjectStore((state) => state.createProject);
  const [projectName, setProjectName] = useState("My Guided Obby");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAttemptRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const approval = useMemo<ApprovedDirectorSceneApproval>(
    () => ({
      draft,
      draftContentBinding,
      approvalState,
      approvedFingerprint,
      approvedContentBinding,
    }),
    [
      draft,
      draftContentBinding,
      approvalState,
      approvedFingerprint,
      approvedContentBinding,
    ],
  );
  const proposal = useMemo(() => proposalFor(approval), [approval]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const attemptId = activeAttemptRef.current;
      if (attemptId) {
        useGuidedSceneStore.getState().abandonCreation(attemptId);
      }
      activeAttemptRef.current = null;
    };
  }, []);

  if (!proposal) return null;

  const checkpointCount = proposal.elements.filter(
    (element) => element.type === "checkpoint",
  ).length;

  const handleCreate = async () => {
    if (isCreating || activeAttemptRef.current) return;
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      setError("Give this game a project name before creating it.");
      return;
    }

    const currentDirector = useGameDirectorStore.getState();
    const currentProposal = proposalFor({
      draft: currentDirector.draft,
      draftContentBinding: currentDirector.draftContentBinding,
      approvalState: currentDirector.approvalState,
      approvedFingerprint: currentDirector.approvedFingerprint,
      approvedContentBinding: currentDirector.approvedContentBinding,
    });
    if (
      !currentProposal ||
      currentProposal.proposalId !== proposal.proposalId ||
      currentProposal.revision !== proposal.revision
    ) {
      setError("The approved brief changed. Review and approve it again first.");
      return;
    }

    const attemptId = nextCreationAttemptId(currentProposal.proposalId);
    if (!useGuidedSceneStore.getState().stage(currentProposal, attemptId)) {
      setError("The approved brief is no longer current. Approve it again first.");
      return;
    }

    activeAttemptRef.current = attemptId;
    setIsCreating(true);
    setError(null);
    try {
      const project = await createProject("obby", trimmedName);
      if (activeAttemptRef.current !== attemptId) return;
      if (!project) {
        useGuidedSceneStore.getState().abandonCreation(attemptId);
        activeAttemptRef.current = null;
        setError(
          isTauriRuntime()
            ? "RobloxForge could not create the desktop project. Check the project setup and try again."
            : "RobloxForge could not create the temporary preview project.",
        );
        return;
      }

      if (
        !useGuidedSceneStore
          .getState()
          .bindCreatedProject(attemptId, project)
      ) {
        activeAttemptRef.current = null;
        setError(
          "The brief changed while the project was being created. The generated scene was not applied.",
        );
        return;
      }

      activeAttemptRef.current = null;
      navigate("/build");
    } finally {
      if (activeAttemptRef.current === attemptId) {
        useGuidedSceneStore.getState().abandonCreation(attemptId);
        activeAttemptRef.current = null;
      }
      if (mountedRef.current) setIsCreating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-300">
          <Boxes size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">
            Approved scene proposal
          </p>
          <h3 className="mt-1 text-lg font-black text-white">
            Create an editable starting world
          </h3>
          <p className="mt-1 text-sm leading-6 text-emerald-100/70">
            This generates original, unlocked parts from this exact brief. It
            does not copy reference assets, scripts, URLs, or place IDs.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-emerald-900/60 bg-gray-950/40 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Theme
          </dt>
          <dd className="mt-1 text-sm font-bold text-gray-100">{proposal.theme}</dd>
        </div>
        <div className="rounded-xl border border-emerald-900/60 bg-gray-950/40 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Stages
          </dt>
          <dd className="mt-1 text-sm font-bold text-gray-100">
            {proposal.stageCount}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-900/60 bg-gray-950/40 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Recovery
          </dt>
          <dd className="mt-1 text-sm font-bold text-gray-100">
            {checkpointCount} checkpoints
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-900/60 bg-gray-950/40 p-3">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Mechanic track
          </dt>
          <dd className="mt-1 text-sm font-bold text-gray-100">
            {proposal.mechanicTrack}
          </dd>
        </div>
      </dl>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
          Project name
        </span>
        <input
          aria-label="Guided project name"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          disabled={isCreating}
          maxLength={80}
          className="w-full rounded-xl border border-gray-700/70 bg-gray-950/70 px-3.5 py-3 text-sm text-gray-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
        />
      </label>

      <p className="mt-2 text-xs leading-5 text-gray-400">
        {isTauriRuntime()
          ? "Desktop mode will create files in your configured RobloxForge projects folder."
          : "Browser preview is temporary. Use RobloxForge Desktop for durable project files and Studio export."}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-200"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleCreate}
        disabled={isCreating || projectName.trim().length === 0}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {isCreating ? (
          <Loader2 className="animate-spin" size={17} />
        ) : (
          <Sparkles size={17} />
        )}
        {isCreating ? "Creating editable world..." : "Create editable Obby"}
      </button>
    </div>
  );
}
