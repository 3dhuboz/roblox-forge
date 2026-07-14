import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { Layout } from "../../components/Layout";
import { GameDirectorPage } from "../../features/director/GameDirectorPage";
import {
  aiCommands,
  browserPreviewService,
  buildCommands,
  projectCommands,
} from "../../services/tauriCommands";
import { useGameDirectorStore } from "../../stores/gameDirectorStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";

const initialProjectState = useProjectStore.getState();
const initialUserProfile = useUserStore.getState().profile;

function renderDirector() {
  return render(
    <MemoryRouter initialEntries={["/director"]}>
      <Routes>
        <Route path="/director" element={<GameDirectorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useGameDirectorStore.getState().reset();
  useProjectStore.setState(initialProjectState, true);
});

afterEach(() => {
  useGameDirectorStore.getState().reset();
  useProjectStore.setState(initialProjectState, true);
  useUserStore.setState({ profile: initialUserProfile });
  vi.restoreAllMocks();
});

describe("Game Director local approval flow", () => {
  it("generates, edits, approves, and invalidates without authority mutation", async () => {
    const user = userEvent.setup();
    const projectCreate = vi.spyOn(projectCommands, "createProject");
    const previewCreate = vi.spyOn(browserPreviewService, "createProject");
    const build = vi.spyOn(buildCommands, "buildProject");
    const chat = vi.spyOn(aiCommands, "sendChatMessage");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch must not be used"));
    const projectBefore = useProjectStore.getState().project;

    renderDirector();
    fireEvent.change(screen.getByLabelText("Describe your game"), {
      target: {
        value:
          "A neon space obby where players escape through ten checkpoint stages.",
      },
    });
    await user.click(
      screen.getByRole("checkbox", { name: /Checkpoint progression/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Create local game brief" }),
    );

    expect(
      await screen.findByText(
        "Deterministic local draft — AI authority unavailable",
      ),
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText(
        "Intended player achievement",
      ) as HTMLTextAreaElement).value,
    ).toMatch(/final checkpoint/i);
    const approve = screen.getByRole("button", {
      name: "Approve this brief locally",
    });
    expect(approve).toBeEnabled();
    await user.click(approve);
    expect(screen.getByRole("status")).toHaveTextContent("Approved locally");

    await user.clear(screen.getByLabelText("Intended player achievement"));
    expect(screen.getByText("Review required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve this brief locally" }),
    ).toBeDisabled();
    expect(useProjectStore.getState().project).toBe(projectBefore);
    expect(projectCreate).not.toHaveBeenCalled();
    expect(previewCreate).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires at least one meaningful assumption before local approval", async () => {
    const user = userEvent.setup();
    renderDirector();
    fireEvent.change(screen.getByLabelText("Describe your game"), {
      target: { value: "A neon obby with ten checkpoints and quick recovery." },
    });
    await user.click(
      screen.getByRole("button", { name: "Create local game brief" }),
    );

    const assumptions = await screen.findByLabelText("Assumptions");
    await user.clear(assumptions);

    expect(
      screen.getByRole("button", { name: "Approve this brief locally" }),
    ).toBeDisabled();
    expect(screen.getByText("Review required")).toBeInTheDocument();
  });

  it("keeps an arbitrary reference blocked, inert, and unapprovable", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("blocked references must remain inert"));
    renderDirector();
    fireEvent.change(screen.getByLabelText("Describe your game"), {
      target: { value: "An obby with checkpoints and a final escape." },
    });
    await user.selectOptions(
      screen.getByLabelText("Reference source"),
      "public_metadata",
    );
    fireEvent.change(screen.getByLabelText("Reference name or URL"), {
      target: {
        value: "https://www.roblox.com/games/999/RAW_REFERENCE_WORLD",
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/blocked/i);
    await user.click(
      screen.getByRole("button", { name: "Create local game brief" }),
    );

    await waitFor(() =>
      expect(useGameDirectorStore.getState().draft).not.toBeNull(),
    );
    const state = useGameDirectorStore.getState();
    expect(state.referencePolicy?.provenance.policyDecision).toBe("blocked");
    expect(JSON.stringify(state.draft)).not.toContain("RAW_REFERENCE_WORLD");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Approve this brief locally" }),
    ).toBeDisabled();
    expect(screen.getByText(/blocked reference cannot be used/i)).toBeVisible();
  });

  it("labels unsupported genres as review-only", async () => {
    const user = userEvent.setup();
    renderDirector();
    fireEvent.change(screen.getByLabelText("Describe your game"), {
      target: {
        value: "A deep roleplay city with hundreds of jobs and homes.",
      },
    });
    await user.click(
      screen.getByRole("button", { name: "Create local game brief" }),
    );

    expect(await screen.findByText("Review-only concept")).toBeInTheDocument();
    expect(screen.getByLabelText("Genre")).toHaveValue("Roleplay");
    expect(
      screen.getByRole("button", { name: "Approve this brief locally" }),
    ).toBeDisabled();
  });
});

describe("Game Director navigation", () => {
  it("exposes a Director link in the application layout", () => {
    render(
      <MemoryRouter initialEntries={["/director"]}>
        <Layout>
          <div>Director route content</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Director/i })).toHaveAttribute(
      "href",
      "/director",
    );
  });

  it("mounts the lazy Director page through the real application route", async () => {
    useUserStore.setState({
      profile: { ...initialUserProfile, hasCompletedOnboarding: true },
    });

    render(
      <MemoryRouter initialEntries={["/director"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Decide what the game achieves before building it",
      }),
    ).toBeInTheDocument();
  });
});
