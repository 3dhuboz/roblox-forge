import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevModeBanner } from "../../components/DevModeBanner";
import { TemplateSelector } from "../../features/templates/TemplateSelector";
import {
  browserPreviewService,
  projectCommands,
} from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import { useToastStore } from "../../stores/toastStore";
import type { ProjectInfo, ProjectState } from "../../types/project";

const RECENT_PROJECTS_KEY = "roblox-forge-recent";
const originalProjectStoreState = useProjectStore.getState();

const desktopProject: ProjectInfo = {
  name: "Desktop Contract",
  path: "D:/RobloxForge/DesktopContract",
  template: "obby",
  createdAt: "2000-02-01T00:00:00.000Z",
};

const desktopProjectState: ProjectState = {
  name: desktopProject.name,
  path: desktopProject.path,
  template: desktopProject.template,
  hierarchy: {
    className: "DataModel",
    name: "DataModel",
    properties: {},
    children: [],
  },
  scripts: [],
  stageCount: 1,
};

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderTemplateSelector() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <TemplateSelector />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function chooseObbyAndName(name: string): Promise<void> {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", {
      name: /Obstacle course with stages, checkpoints, and kill bricks/i,
    }),
  );
  await user.type(screen.getByRole("textbox"), name);
  await user.click(screen.getByRole("button", { name: "Let's Go!" }));
}

beforeEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  useProjectStore.setState(originalProjectStoreState, true);
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  useProjectStore.setState(originalProjectStoreState, true);
  useToastStore.setState({ toasts: [] });
  vi.restoreAllMocks();
});

describe("project store runtime routing", () => {
  it("creates and loads a browser-preview project without calling desktop commands", async () => {
    const previewCreate = vi.spyOn(browserPreviewService, "createProject");
    const previewGetState = vi.spyOn(browserPreviewService, "getProjectState");
    const desktopCreate = vi.spyOn(projectCommands, "createProject");
    const desktopGetState = vi.spyOn(projectCommands, "getProjectState");

    const created = await useProjectStore
      .getState()
      .createProject("obby", "Preview Store Contract");

    expect(created).toEqual(
      expect.objectContaining({
        path: "browser-preview://Preview_Store_Contract",
        template: "obby",
      }),
    );
    expect(previewCreate).toHaveBeenCalledWith(
      "obby",
      "Preview Store Contract",
    );
    expect(previewGetState).toHaveBeenCalledWith(
      "browser-preview://Preview_Store_Contract",
    );
    expect(desktopCreate).not.toHaveBeenCalled();
    expect(desktopGetState).not.toHaveBeenCalled();
    expect(useProjectStore.getState().project?.path).toBe(
      "browser-preview://Preview_Store_Contract",
    );
    expect(useProjectStore.getState().projectState?.path).toBe(
      "browser-preview://Preview_Store_Contract",
    );
  });

  it("returns false and clears stale project data when preview creation fails", async () => {
    useProjectStore.setState({
      project: desktopProject,
      projectState: desktopProjectState,
      error: "stale error",
    });
    vi.spyOn(browserPreviewService, "createProject").mockRejectedValueOnce(
      new Error("preview unavailable"),
    );
    const previewGetState = vi.spyOn(
      browserPreviewService,
      "getProjectState",
    );

    const created = await useProjectStore
      .getState()
      .createProject("obby", "Broken Preview");

    expect(created).toBeNull();
    expect(previewGetState).not.toHaveBeenCalled();
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        project: null,
        projectState: null,
        isLoading: false,
      }),
    );
    expect(useProjectStore.getState().error).toContain("preview unavailable");
  });

  it("keeps project creation on desktop commands in the Tauri runtime", async () => {
    enableTauriRuntime();
    const desktopCreate = vi
      .spyOn(projectCommands, "createProject")
      .mockResolvedValueOnce(desktopProject);
    const desktopGetState = vi
      .spyOn(projectCommands, "getProjectState")
      .mockResolvedValueOnce(desktopProjectState);
    const previewCreate = vi.spyOn(browserPreviewService, "createProject");
    const previewGetState = vi.spyOn(browserPreviewService, "getProjectState");

    const created = await useProjectStore
      .getState()
      .createProject("obby", desktopProject.name);

    expect(created).toEqual(desktopProject);
    expect(desktopCreate).toHaveBeenCalledWith("obby", desktopProject.name);
    expect(desktopGetState).toHaveBeenCalledWith(desktopProject.path);
    expect(previewCreate).not.toHaveBeenCalled();
    expect(previewGetState).not.toHaveBeenCalled();
    expect(useProjectStore.getState().project).toEqual(desktopProject);
    expect(useProjectStore.getState().projectState).toEqual(
      desktopProjectState,
    );
  });
});

describe("template navigation truth", () => {
  it("does not save or navigate when project creation fails", async () => {
    const createProject = vi.fn().mockResolvedValue(null);
    useProjectStore.setState({ createProject });
    renderTemplateSelector();

    await chooseObbyAndName("Failed Game");

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(RECENT_PROJECTS_KEY)).toBeNull();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });

  it("saves the actual created preview path before navigating", async () => {
    const createdProject: ProjectInfo = {
      name: "Canonical Preview Name",
      path: "browser-preview://actual-service-path",
      template: "obby",
      createdAt: "2000-03-01T00:00:00.000Z",
    };
    const createProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({ project: createdProject });
      return createdProject;
    });
    useProjectStore.setState({ createProject });
    renderTemplateSelector();

    await chooseObbyAndName("Typed Name Is Not The Path");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/build"),
    );
    expect(JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) ?? "[]")).toEqual([
      createdProject,
    ]);
  });

  it("does not navigate when reopening a recent project fails", async () => {
    localStorage.setItem(
      RECENT_PROJECTS_KEY,
      JSON.stringify([
        {
          name: "Unavailable Recent Preview",
          path: "browser-preview://Unavailable_Recent_Preview",
          template: "obby",
          createdAt: "2000-04-01T00:00:00.000Z",
        },
      ]),
    );
    const createProject = vi.fn().mockResolvedValue(null);
    useProjectStore.setState({ createProject });
    renderTemplateSelector();

    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /Unavailable Recent Preview/i }),
      );

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
  });
});

describe("browser preview banner", () => {
  it("identifies temporary browser preview limits accessibly", () => {
    render(<DevModeBanner />);

    const banner = screen.getByRole("status", {
      name: "Browser preview mode",
    });
    expect(banner).toHaveTextContent("Browser preview");
    expect(banner).toHaveTextContent(/in-memory and temporary/i);
    expect(banner).toHaveTextContent(
      /Build, publish, and Roblox analytics require RobloxForge Desktop/i,
    );
  });

  it("does not render the preview banner in Tauri", () => {
    enableTauriRuntime();
    render(<DevModeBanner />);

    expect(
      screen.queryByRole("status", { name: "Browser preview mode" }),
    ).not.toBeInTheDocument();
  });
});
