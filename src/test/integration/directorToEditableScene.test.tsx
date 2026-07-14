import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectorApprovalPanel } from "../../features/director/DirectorApprovalPanel";
import { BuildPage } from "../../features/build/BuildPage";
import { getDefaultLogic } from "../../lib/gameLogic";
import {
  useCanvasStore,
  type CanvasElement,
} from "../../stores/canvasStore";
import { useGameDirectorStore } from "../../stores/gameDirectorStore";
import { useGuidedSceneStore } from "../../stores/guidedSceneStore";
import { useProjectStore } from "../../stores/projectStore";

vi.mock("../../features/builder/GameCanvas3D", () => ({
  GameCanvas3D: () => <div data-testid="guided-3d-canvas" />,
}));
vi.mock("../../features/builder/AiSceneChat", () => ({
  AiSceneChat: () => <div>AI scene chat</div>,
}));
vi.mock("../../features/builder/VisualScriptEditor", () => ({
  VisualScriptEditor: () => <div>Visual script editor</div>,
}));
vi.mock("../../features/build/MonetizationPanel", () => ({
  MonetizationPanel: () => <div>Monetization panel</div>,
}));
vi.mock("../../features/build/InstanceExplorer", () => ({
  InstanceExplorer: () => <div>Instance explorer</div>,
}));
vi.mock("../../features/build/PropertyInspector", () => ({
  PropertyInspector: () => <div>Property inspector</div>,
}));

const originalProjectState = useProjectStore.getState();
const originalCanvasState = useCanvasStore.getState();

const reference = {
  sourceKind: "user_authored_abstract" as const,
  rightsBasis: "user_authored" as const,
  rightsEvidenceRef: "local-description",
  aiUseAuthorization: "user_authored" as const,
  aiUseEvidenceRef: "local-description",
  referenceLocator: "",
  selectedTraits: ["checkpoint_progression"] as const,
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={["/director"]}>
      <LocationProbe />
      <Routes>
        <Route path="/director" element={<DirectorApprovalPanel />} />
        <Route path="/build" element={<BuildPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderBuildOnly() {
  return render(
    <MemoryRouter initialEntries={["/build"]}>
      <Routes>
        <Route path="/build" element={<BuildPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function approveObby() {
  await useGameDirectorStore.getState().generateDraft({
    idea: "An original neon sky obby with checkpoints, hazards, and fast recovery.",
    reference,
  });
  expect(useGameDirectorStore.getState().approveDraft()).toBe(true);
}

function sentinelElement(): CanvasElement {
  return {
    id: "sentinel",
    type: "ground",
    category: "terrain",
    label: "Existing canvas",
    icon: "square",
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    color: "#333333",
    rotation: 0,
    locked: false,
    visible: true,
    properties: {},
    logic: getDefaultLogic("ground", "obby"),
  };
}

beforeEach(() => {
  delete (window as typeof window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
  localStorage.clear();
  useGameDirectorStore.getState().reset();
  useGuidedSceneStore.getState().reset();
  useProjectStore.setState(originalProjectState, true);
  useCanvasStore.setState(originalCanvasState, true);
  useCanvasStore.setState({
    elements: [],
    sceneProjectPath: null,
    appliedGuidedProposalId: null,
    saveToProject: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  useGameDirectorStore.getState().reset();
  useGuidedSceneStore.getState().reset();
  useProjectStore.setState(originalProjectState, true);
  useCanvasStore.setState(originalCanvasState, true);
  vi.restoreAllMocks();
});

describe("approved Director brief to editable 3D scene", () => {
  it("confirms the proposal, creates one project, and applies it once", async () => {
    await approveObby();
    const user = userEvent.setup();
    renderFlow();

    expect(
      screen.getByRole("heading", { name: "Create an editable starting world" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Browser preview is temporary/i)).toBeVisible();
    await user.clear(screen.getByLabelText("Guided project name"));
    await user.type(screen.getByLabelText("Guided project name"), "Neon Recovery Run");
    await user.click(
      screen.getByRole("button", { name: "Create editable Obby" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/build"),
    );
    expect(screen.getByText("Neon Recovery Run")).toBeVisible();
    expect(screen.getByText("Toolbox")).toBeVisible();
    expect(screen.getByTestId("guided-3d-canvas")).toBeInTheDocument();

    const generated = useCanvasStore.getState();
    expect(generated.appliedGuidedProposalId).toBeTruthy();
    expect(generated.elements.length).toBeGreaterThan(5);
    expect(generated.elements.every((element) => !element.locked)).toBe(true);
    expect(generated.elements.some((element) => element.type === "spawn")).toBe(
      true,
    );
    expect(
      generated.elements.some((element) => element.type === "checkpoint"),
    ).toBe(true);

    const firstId = generated.elements[0]!.id;
    useCanvasStore.getState().updateElement(firstId, { label: "My edited part" });
    const currentProjectState = useProjectStore.getState().projectState!;
    useProjectStore.setState({
      projectState: {
        ...currentProjectState,
        hierarchy: { ...currentProjectState.hierarchy },
      },
    });

    await waitFor(() =>
      expect(
        useCanvasStore.getState().elements.find((element) => element.id === firstId)
          ?.label,
      ).toBe("My edited part"),
    );
  });

  it("leaves the canvas unchanged when project creation fails", async () => {
    await approveObby();
    const existing = sentinelElement();
    useCanvasStore.setState({ elements: [existing] });
    const createProject = vi.fn().mockResolvedValue(null);
    useProjectStore.setState({ createProject });
    const user = userEvent.setup();
    renderFlow();

    await user.click(
      screen.getByRole("button", { name: "Create editable Obby" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not create the temporary preview project/i,
    );
    expect(useCanvasStore.getState().elements).toEqual([existing]);
    expect(useGuidedSceneStore.getState().staged).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent("/director");
  });

  it("refuses to hydrate hierarchy state owned by a different project path", async () => {
    const existing = sentinelElement();
    useCanvasStore.setState({ elements: [existing] });
    useProjectStore.setState({
      project: {
        name: "Current Project",
        path: "browser-preview://current-project",
        template: "obby",
        createdAt: "2026-07-14T00:00:00.000Z",
      },
      projectState: {
        name: "Stale Project",
        path: "browser-preview://stale-project",
        template: "obby",
        scripts: [],
        stageCount: 0,
        hierarchy: {
          className: "DataModel",
          name: "StaleGame",
          properties: {},
          children: [],
        },
      },
    });

    renderBuildOnly();
    expect(await screen.findByText("Current Project")).toBeVisible();

    expect(useCanvasStore.getState().sceneProjectPath).toBeNull();
    expect(useCanvasStore.getState().elements).toEqual([existing]);
  });
});
