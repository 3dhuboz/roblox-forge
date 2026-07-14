import { AlertTriangle, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import {
  directorDraftContentBinding,
  DIRECTOR_GENRES,
  isDirectorDraftApprovable,
  type GameDirectorDraft,
} from "../../intelligence/gameDirectorDraft";
import {
  useGameDirectorStore,
  type EditableDirectorField,
  type EditableDirectorList,
} from "../../stores/gameDirectorStore";

const TEXT_FIELDS: ReadonlyArray<{
  field: EditableDirectorField;
  label: string;
  rows: number;
}> = [
  { field: "genre", label: "Genre", rows: 1 },
  {
    field: "intendedAchievement",
    label: "Intended player achievement",
    rows: 2,
  },
  { field: "playerFantasy", label: "Player fantasy", rows: 2 },
  { field: "loops.momentToMoment", label: "Core loop", rows: 2 },
  { field: "loops.thirtySecond", label: "30-second loop", rows: 2 },
  { field: "loops.session", label: "Session loop", rows: 2 },
  { field: "loops.longTerm", label: "Long-term loop", rows: 2 },
  { field: "progression", label: "Progression", rows: 2 },
  { field: "outcomes.win", label: "Win condition", rows: 2 },
  { field: "outcomes.failure", label: "Failure", rows: 2 },
  { field: "outcomes.recovery", label: "Recovery", rows: 2 },
  { field: "economy.sources", label: "Economy sources", rows: 2 },
  { field: "economy.sinks", label: "Economy sinks", rows: 2 },
  {
    field: "monetizationSafety",
    label: "Monetization safety",
    rows: 2,
  },
  { field: "aesthetic", label: "Aesthetic direction", rows: 2 },
];

const LIST_FIELDS: ReadonlyArray<{
  field: EditableDirectorList;
  label: string;
  help: string;
}> = [
  {
    field: "assumptions",
    label: "Assumptions",
    help: "One assumption per line.",
  },
  {
    field: "materialQuestions",
    label: "Material questions",
    help: "Every material question must be resolved before approval.",
  },
  {
    field: "originalitySafeguards",
    label: "Originality safeguards and differences",
    help: "At least three meaningful differences are required.",
  },
];

function fieldValue(draft: GameDirectorDraft, field: EditableDirectorField) {
  switch (field) {
    case "genre":
    case "intendedAchievement":
    case "playerFantasy":
    case "progression":
    case "monetizationSafety":
    case "aesthetic":
      return draft[field];
    case "loops.momentToMoment":
      return draft.loops.momentToMoment;
    case "loops.thirtySecond":
      return draft.loops.thirtySecond;
    case "loops.session":
      return draft.loops.session;
    case "loops.longTerm":
      return draft.loops.longTerm;
    case "outcomes.win":
      return draft.outcomes.win;
    case "outcomes.failure":
      return draft.outcomes.failure;
    case "outcomes.recovery":
      return draft.outcomes.recovery;
    case "economy.sources":
      return draft.economy.sources;
    case "economy.sinks":
      return draft.economy.sinks;
  }
}

function lines(value: string): string[] {
  return value.length === 0 ? [] : value.split("\n");
}

export function DirectorApprovalPanel() {
  const draft = useGameDirectorStore((state) => state.draft);
  const approvalState = useGameDirectorStore((state) => state.approvalState);
  const approvedFingerprint = useGameDirectorStore(
    (state) => state.approvedFingerprint,
  );
  const approvedContentBinding = useGameDirectorStore(
    (state) => state.approvedContentBinding,
  );
  const updateDraftField = useGameDirectorStore(
    (state) => state.updateDraftField,
  );
  const updateDraftList = useGameDirectorStore(
    (state) => state.updateDraftList,
  );
  const approveDraft = useGameDirectorStore((state) => state.approveDraft);

  if (!draft) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-gray-700/70 bg-gray-900/40 p-8 text-center">
        <div className="max-w-md">
          <FileCheck2 className="mx-auto text-indigo-400" size={34} />
          <h2 className="mt-4 text-xl font-bold text-white">
            Your editable game brief appears here
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            The Director first decides what the player should achieve and how
            the game operates. Nothing is built or published at this stage.
          </p>
        </div>
      </section>
    );
  }

  const approvable = isDirectorDraftApprovable(draft);
  const approved =
    approvalState === "approved_locally" &&
    approvedFingerprint === draft.fingerprint &&
    approvedContentBinding === directorDraftContentBinding(draft);

  return (
    <section className="space-y-5 rounded-3xl border border-gray-800/80 bg-gray-900/70 p-5 shadow-2xl shadow-black/20 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-400">
            Editable brief
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            Review how the game should work
          </h2>
        </div>
        <div
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            approved
              ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
              : "border-amber-700/50 bg-amber-950/30 text-amber-300"
          }`}
          role="status"
          aria-label="Director approval status"
        >
          {approved ? "Approved locally" : "Review required"}
        </div>
      </div>

      {draft.approvalBlocked ? (
        <div
          className="rounded-2xl border border-amber-700/40 bg-amber-950/30 p-4"
          role="alert"
        >
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle size={17} /> Review-only concept
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/80">
            {draft.approvalBlockReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {TEXT_FIELDS.map(({ field, label, rows }) => (
          <label
            className={
              field === "genre" ? "block" : "block lg:col-span-2"
            }
            key={field}
          >
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
              {label}
            </span>
            {field === "genre" ? (
              <select
                aria-label={label}
                value={fieldValue(draft, field)}
                onChange={(event) =>
                  updateDraftField(field, event.target.value)
                }
                className="w-full rounded-xl border border-gray-700/70 bg-gray-950/70 px-3.5 py-3 text-sm leading-6 text-gray-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                {DIRECTOR_GENRES.map((genre) => (
                  <option value={genre} key={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                aria-label={label}
                rows={rows}
                value={fieldValue(draft, field)}
                onChange={(event) =>
                  updateDraftField(field, event.target.value)
                }
                className="w-full resize-y rounded-xl border border-gray-700/70 bg-gray-950/70 px-3.5 py-3 text-sm leading-6 text-gray-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            )}
          </label>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {LIST_FIELDS.map(({ field, label, help }) => (
          <label className="block" key={field}>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
              {label}
            </span>
            <textarea
              aria-label={label}
              rows={7}
              value={draft[field].join("\n")}
              onChange={(event) => updateDraftList(field, lines(event.target.value))}
              className="w-full resize-y rounded-xl border border-gray-700/70 bg-gray-950/70 px-3.5 py-3 text-sm leading-6 text-gray-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
            <span className="mt-1 block text-[11px] leading-4 text-gray-500">
              {help}
            </span>
          </label>
        ))}
      </div>

      <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 p-4 text-sm text-indigo-100/80">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <ShieldCheck size={17} /> Originality and safety gate
        </div>
        <p className="mt-1 leading-6">
          Approval stores an exact local content snapshot. The short revision
          marker below is display-only. Approval does not create a project,
          prove identity, authorize rights, open Studio, or make the game
          build-ready.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-gray-500">
          Revision marker: {" "}
          <code className="text-gray-400">{draft.fingerprint}</code>
        </div>
        <button
          type="button"
          onClick={approveDraft}
          disabled={!approvable || approved}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {approved ? <CheckCircle2 size={17} /> : <FileCheck2 size={17} />}
          {approved ? "Brief approved locally" : "Approve this brief locally"}
        </button>
      </div>
    </section>
  );
}
