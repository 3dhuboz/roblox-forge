import { useMemo, useState } from "react";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Info,
  Loader2,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import {
  ABSTRACT_TRAIT_CATALOG,
  evaluateReferenceInput,
  type AbstractReferenceTrait,
  type ReferenceAiUseAuthorization,
  type ReferenceRightsBasis,
  type ReferenceSourceKind,
} from "../../intelligence/referenceInputPolicy";
import { useGameDirectorStore } from "../../stores/gameDirectorStore";
import { DirectorApprovalPanel } from "./DirectorApprovalPanel";

const TRAIT_LABELS: Record<AbstractReferenceTrait, string> = {
  checkpoint_progression: "Checkpoint progression",
  collection: "Collection goals",
  cooperative_play: "Cooperative play",
  customization: "Cosmetic customization",
  escalating_challenge: "Escalating challenge",
  exploration: "Exploration",
  live_events: "Live-event variation",
  rapid_recovery: "Rapid recovery",
  short_sessions: "Short sessions",
  skill_mastery: "Skill mastery",
  social_co_play: "Social co-play",
  visible_progression: "Visible progression",
};

const POLICY_COPY = {
  allowed: {
    title: "Allowed for abstract context",
    body: "Your declaration permits only the selected generic mechanics. No external game is fetched in this private-alpha slice.",
  },
  needs_review: {
    title: "Manual template — review required",
    body: "Copy-enabled access is not AI-use permission. This source remains outside all AI context and needs per-asset rights review.",
  },
  blocked: {
    title: "Blocked reference",
    body: "This reference cannot influence the brief. Remove it or provide an owner/express AI-use declaration with evidence.",
  },
} as const;

const LOCAL_DESCRIPTION_EVIDENCE = "local-user-description";

function sourceDefaults(sourceKind: ReferenceSourceKind): {
  rightsBasis: ReferenceRightsBasis;
  rightsEvidenceRef: string;
  aiUseAuthorization: ReferenceAiUseAuthorization;
  aiUseEvidenceRef: string | null;
} {
  switch (sourceKind) {
    case "owner_authored":
      return {
        rightsBasis: "owned",
        rightsEvidenceRef: "",
        aiUseAuthorization: "owner_authorized",
        aiUseEvidenceRef: "",
      };
    case "licensed_template":
      return {
        rightsBasis: "expressly_licensed",
        rightsEvidenceRef: "",
        aiUseAuthorization: "expressly_ai_licensed",
        aiUseEvidenceRef: "",
      };
    case "copy_enabled_template":
      return {
        rightsBasis: "copy_enabled",
        rightsEvidenceRef: "",
        aiUseAuthorization: "not_authorized",
        aiUseEvidenceRef: null,
      };
    case "public_metadata":
      return {
        rightsBasis: "public_metadata_only",
        rightsEvidenceRef: "",
        aiUseAuthorization: "public_metadata_only",
        aiUseEvidenceRef: "",
      };
    case "user_authored_abstract":
      return {
        rightsBasis: "user_authored",
        rightsEvidenceRef: LOCAL_DESCRIPTION_EVIDENCE,
        aiUseAuthorization: "user_authored",
        aiUseEvidenceRef: LOCAL_DESCRIPTION_EVIDENCE,
      };
  }
}

export function GameDirectorPage() {
  const [idea, setIdea] = useState("");
  const [sourceKind, setSourceKind] =
    useState<ReferenceSourceKind>("user_authored_abstract");
  const [referenceLocator, setReferenceLocator] = useState("");
  const [rightsBasis, setRightsBasis] =
    useState<ReferenceRightsBasis>("user_authored");
  const [rightsEvidenceRef, setRightsEvidenceRef] = useState(
    LOCAL_DESCRIPTION_EVIDENCE,
  );
  const [aiUseAuthorization, setAiUseAuthorization] =
    useState<ReferenceAiUseAuthorization>("user_authored");
  const [aiUseEvidenceRef, setAiUseEvidenceRef] = useState<string | null>(
    LOCAL_DESCRIPTION_EVIDENCE,
  );
  const [selectedTraits, setSelectedTraits] = useState<AbstractReferenceTrait[]>(
    [],
  );

  const generationStatus = useGameDirectorStore(
    (state) => state.generationStatus,
  );
  const generationLabel = useGameDirectorStore(
    (state) => state.generationLabel,
  );
  const error = useGameDirectorStore((state) => state.error);
  const generateDraft = useGameDirectorStore((state) => state.generateDraft);

  const referenceInput = useMemo(
    () => ({
      sourceKind,
      rightsBasis,
      rightsEvidenceRef,
      aiUseAuthorization,
      aiUseEvidenceRef,
      referenceLocator,
      selectedTraits,
    }),
    [
      aiUseAuthorization,
      aiUseEvidenceRef,
      referenceLocator,
      rightsBasis,
      rightsEvidenceRef,
      selectedTraits,
      sourceKind,
    ],
  );
  const policy = useMemo(
    () => evaluateReferenceInput(referenceInput),
    [referenceInput],
  );
  const policyCopy =
    sourceKind === "user_authored_abstract"
      ? {
          title: "Your own description",
          body: "Only your description and selected generic mechanics enter this local brief.",
        }
      : POLICY_COPY[policy.provenance.policyDecision];

  const toggleTrait = (trait: AbstractReferenceTrait) => {
    setSelectedTraits((current) =>
      current.includes(trait)
        ? current.filter((item) => item !== trait)
        : [...current, trait],
    );
  };

  const handleSourceChange = (next: ReferenceSourceKind) => {
    setSourceKind(next);
    setReferenceLocator("");
    const defaults = sourceDefaults(next);
    setRightsBasis(defaults.rightsBasis);
    setRightsEvidenceRef(defaults.rightsEvidenceRef);
    setAiUseAuthorization(defaults.aiUseAuthorization);
    setAiUseEvidenceRef(defaults.aiUseEvidenceRef);
  };

  const handleGenerate = async () => {
    await generateDraft({ idea, reference: referenceInput });
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.15),_transparent_34%),linear-gradient(to_bottom,_#030712,_#0b1020)]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
        <header className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-700/40 bg-indigo-950/40 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-300">
              <BrainCircuit size={14} /> Game Director
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Decide what the game achieves before building it
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">
              Describe the player goal and the Director turns it into an
              editable operating brief: loops, progression, failure, recovery,
              economy, monetization safety, and original visual direction.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-xs leading-5 text-gray-400">
            <span className="font-bold text-gray-200">Private alpha:</span> this
            step creates a local brief only. It cannot build, publish, fetch a
            reference game, or claim live AI authority.
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-5 xl:sticky xl:top-6">
            <section className="rounded-3xl border border-gray-800/80 bg-gray-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Sparkles size={17} className="text-indigo-400" /> 1. Describe
                the game
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
                  What should the player achieve?
                </span>
                <textarea
                  aria-label="Describe your game"
                  rows={5}
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="Example: A neon space obby where players escape through ten checkpoint stages..."
                  className="w-full resize-y rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>
              <p className="mt-2 text-[11px] leading-4 text-gray-500">
                The deterministic private-alpha builder supports a complete Obby
                path. Other genres are drafted as review-only concepts.
              </p>
            </section>

            <section className="rounded-3xl border border-gray-800/80 bg-gray-900/80 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <LockKeyhole size={17} className="text-violet-400" /> 2.
                Reference rights gate
              </div>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
                  Reference source
                </span>
                <select
                  aria-label="Reference source"
                  value={sourceKind}
                  onChange={(event) =>
                    handleSourceChange(event.target.value as ReferenceSourceKind)
                  }
                  className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500"
                >
                  <option value="user_authored_abstract">
                    My own description — no external reference
                  </option>
                  <option value="owner_authored">My owned game</option>
                  <option value="licensed_template">
                    Expressly AI-licensed template
                  </option>
                  <option value="copy_enabled_template">
                    Copy-enabled template — manual only
                  </option>
                  <option value="public_metadata">
                    Public metadata only
                  </option>
                </select>
              </label>

              {sourceKind !== "user_authored_abstract" ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      Reference name or URL
                    </span>
                    <input
                      aria-label="Reference name or URL"
                      value={referenceLocator}
                      onChange={(event) => setReferenceLocator(event.target.value)}
                      className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      Rights basis
                    </span>
                    <select
                      aria-label="Rights basis"
                      value={rightsBasis}
                      onChange={(event) =>
                        setRightsBasis(
                          event.target.value as ReferenceRightsBasis,
                        )
                      }
                      className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    >
                      <option value="owned">Owned</option>
                      <option value="expressly_licensed">
                        Expressly licensed
                      </option>
                      <option value="copy_enabled">Copy-enabled</option>
                      <option value="public_metadata_only">
                        Public metadata only
                      </option>
                      <option value="user_authored">User-authored</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      Rights evidence reference
                    </span>
                    <input
                      aria-label="Rights evidence reference"
                      value={rightsEvidenceRef}
                      onChange={(event) => setRightsEvidenceRef(event.target.value)}
                      placeholder="Opaque record ID, not a URL"
                      className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      AI-use authorization
                    </span>
                    <select
                      aria-label="AI-use authorization"
                      value={aiUseAuthorization}
                      onChange={(event) => {
                        const next = event.target
                          .value as ReferenceAiUseAuthorization;
                        setAiUseAuthorization(next);
                        setAiUseEvidenceRef((current) =>
                          next === "not_authorized" ? null : (current ?? ""),
                        );
                      }}
                      className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    >
                      <option value="owner_authorized">
                        Owner authorized
                      </option>
                      <option value="expressly_ai_licensed">
                        Expressly AI licensed
                      </option>
                      <option value="user_authored">User-authored</option>
                      <option value="public_metadata_only">
                        Public metadata only
                      </option>
                      <option value="not_authorized">Not authorized</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">
                      AI-use evidence reference
                    </span>
                    <input
                      aria-label="AI-use evidence reference"
                      value={aiUseEvidenceRef ?? ""}
                      onChange={(event) => setAiUseEvidenceRef(event.target.value)}
                      disabled={aiUseAuthorization === "not_authorized"}
                      placeholder="Opaque authorization record ID"
                      className="w-full rounded-xl border border-gray-700/70 bg-gray-950/80 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>
              ) : null}

              <div
                className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${
                  policy.provenance.policyDecision === "blocked"
                    ? "border-red-800/50 bg-red-950/30 text-red-200"
                    : policy.provenance.policyDecision === "needs_review"
                      ? "border-amber-800/50 bg-amber-950/30 text-amber-200"
                      : "border-emerald-800/40 bg-emerald-950/20 text-emerald-200"
                }`}
                role={
                  policy.provenance.policyDecision === "blocked"
                    ? "alert"
                    : undefined
                }
              >
                <div className="font-bold">{policyCopy.title}</div>
                <p className="mt-0.5 opacity-80">{policyCopy.body}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800/80 bg-gray-900/80 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Check size={17} className="text-cyan-400" /> 3. Reusable
                mechanics
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Choose generic mechanics only. Names, maps, UI, characters,
                code, assets, audio, and distinctive ability bundles are never
                admitted here.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ABSTRACT_TRAIT_CATALOG.map((trait) => (
                  <label
                    key={trait}
                    className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-800 bg-gray-950/50 p-2.5 text-[11px] leading-4 text-gray-300 hover:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTraits.includes(trait)}
                      onChange={() => toggleTrait(trait)}
                      className="mt-0.5 accent-indigo-500"
                    />
                    {TRAIT_LABELS[trait]}
                  </label>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={idea.trim().length < 12 || generationStatus === "generating"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-sm font-black text-white shadow-xl shadow-indigo-950/50 transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generationStatus === "generating" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <BrainCircuit size={18} />
              )}
              Create local game brief
              {generationStatus !== "generating" ? <ChevronRight size={17} /> : null}
            </button>
          </aside>

          <section className="min-w-0 space-y-4" aria-label="Game brief review">
            {generationLabel ? (
              <div className="flex items-start gap-2 rounded-2xl border border-indigo-800/40 bg-indigo-950/20 px-4 py-3 text-sm text-indigo-200">
                <Info size={17} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">{generationLabel}</div>
                  <p className="mt-0.5 text-xs leading-5 text-indigo-200/70">
                    No external reference fetching or copying was used.
                  </p>
                </div>
              </div>
            ) : null}
            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </div>
            ) : null}
            <DirectorApprovalPanel />
          </section>
        </div>
      </div>
    </div>
  );
}
