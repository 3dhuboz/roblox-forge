import { beforeEach, describe, expect, it } from "vitest";
import { getDefaultLogic } from "../lib/gameLogic";
import type { InstanceNode } from "../types/project";
import {
  useCanvasStore,
  type CanvasElement,
} from "./canvasStore";

const originalState = useCanvasStore.getState();

function hierarchy(name: string): InstanceNode {
  return {
    className: "DataModel",
    name: "Game",
    properties: {},
    children: [
      {
        className: "Part",
        name,
        properties: {},
        children: [],
      },
    ],
  };
}

function guidedElement(id: string): CanvasElement {
  return {
    id,
    type: "spawn",
    category: "mechanic",
    label: "Guided Spawn",
    icon: "user-plus",
    x: 20,
    y: 20,
    width: 40,
    height: 40,
    color: "#10b981",
    rotation: 0,
    locked: false,
    visible: true,
    properties: { generatedRole: "spawn" },
    logic: getDefaultLogic("spawn", "obby"),
  };
}

describe("canvas project-path scene ownership", () => {
  beforeEach(() => {
    useCanvasStore.setState(originalState, true);
    useCanvasStore.setState({
      elements: [],
      selectedId: null,
      undoStack: [],
      redoStack: [],
      sceneProjectPath: null,
      appliedGuidedProposalId: null,
    });
  });

  it("hydrates once per project path and never overwrites later user edits", () => {
    const store = useCanvasStore.getState();
    expect(store.hydrateProjectScene("project-a", hierarchy("Base"), "obby")).toBe(
      true,
    );
    expect(useCanvasStore.getState().sceneProjectPath).toBe("project-a");

    const elementId = useCanvasStore.getState().elements[0]?.id;
    expect(elementId).toBeTruthy();
    useCanvasStore.getState().updateElement(elementId!, { label: "User edit" });

    expect(
      useCanvasStore
        .getState()
        .hydrateProjectScene("project-a", hierarchy("Replacement"), "obby"),
    ).toBe(false);
    expect(useCanvasStore.getState().elements[0]?.label).toBe("User edit");
  });

  it("applies one guided proposal only to its hydrated owner path", () => {
    useCanvasStore
      .getState()
      .hydrateProjectScene("project-a", hierarchy("Base"), "obby");
    const generated = guidedElement("guided-spawn");

    expect(
      useCanvasStore
        .getState()
        .applyGuidedProposal("project-b", "proposal-1", [generated]),
    ).toBe(false);
    expect(
      useCanvasStore
        .getState()
        .applyGuidedProposal("project-a", "proposal-1", [generated]),
    ).toBe(true);
    expect(useCanvasStore.getState().elements).toEqual([generated]);

    useCanvasStore
      .getState()
      .updateElement("guided-spawn", { label: "Player changed this" });
    expect(
      useCanvasStore
        .getState()
        .applyGuidedProposal("project-a", "proposal-1", [generated]),
    ).toBe(false);
    expect(useCanvasStore.getState().elements[0]?.label).toBe(
      "Player changed this",
    );
  });

  it("resets proposal ownership when a different project path hydrates", () => {
    useCanvasStore
      .getState()
      .hydrateProjectScene("project-a", hierarchy("Base A"), "obby");
    useCanvasStore
      .getState()
      .applyGuidedProposal("project-a", "proposal-a", [guidedElement("a")]);

    expect(
      useCanvasStore
        .getState()
        .hydrateProjectScene("project-b", hierarchy("Base B"), "obby"),
    ).toBe(true);
    expect(useCanvasStore.getState().appliedGuidedProposalId).toBeNull();
    expect(
      useCanvasStore
        .getState()
        .applyGuidedProposal("project-b", "proposal-b", [guidedElement("b")]),
    ).toBe(true);
  });
});
