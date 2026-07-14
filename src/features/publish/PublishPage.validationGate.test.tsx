import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishPage } from "./PublishPage";
import { publishCommands } from "../../services/tauriCommands";
import { useAuthStore } from "../../stores/authStore";
import { useProjectStore } from "../../stores/projectStore";
import type { AuthState } from "../../types/roblox";
import type { ProjectInfo } from "../../types/project";

const originalAuthStoreState = useAuthStore.getState();
const originalProjectStoreState = useProjectStore.getState();

const auth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "42",
  username: "validation-tester",
  displayName: "Validation Tester",
};

const project: ProjectInfo = {
  name: "Publish Gate Contract",
  path: "D:/RobloxForge/PublishGateContract",
  template: "obby",
  createdAt: "2000-06-01T00:00:00.000Z",
};

beforeEach(() => {
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  useAuthStore.setState({
    auth,
    isConnecting: false,
    error: null,
    checkAuth: vi.fn().mockResolvedValue(undefined),
  });
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "not_run",
    validationError: null,
  });
});

afterEach(() => {
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  vi.restoreAllMocks();
});

async function enterPublishIds(): Promise<void> {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Game Details" });
  await user.type(
    screen.getByPlaceholderText("e.g. 1234567890"),
    "1234567890",
  );
  await user.type(
    screen.getByPlaceholderText("e.g. 9876543210"),
    "9876543210",
  );
}

describe("PublishPage validation gate", () => {
  it.each([
    [
      "validation is running",
      { validationState: "running" as const, fixingIssueId: null },
    ],
    [
      "an auto-fix is running",
      {
        validationState: "not_run" as const,
        fixingIssueId: "stale-warning-proof",
      },
    ],
  ])("disables Check My Game while %s", async (_label, gateState) => {
    useProjectStore.setState(gateState);
    render(<PublishPage />);
    await enterPublishIds();

    expect(
      screen.getByRole("button", { name: "Check My Game" }),
    ).toBeDisabled();
  });

  it("stays on settings and exposes an alert when validation fails", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "failed",
        validationError: "Desktop validation is unavailable.",
      });
      return false;
    });
    useProjectStore.setState({ validateProject });
    const publishGame = vi.spyOn(publishCommands, "publishGame");
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    await waitFor(() => expect(validateProject).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Game Details" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Desktop validation is unavailable.",
    );
    expect(screen.queryByText("Validation Passed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish to Roblox!" }),
    ).not.toBeInTheDocument();
    expect(publishGame).not.toHaveBeenCalled();
  });

  it("advances after a completed passed run and enables publish", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      });
      return true;
    });
    useProjectStore.setState({ validateProject });
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    expect(await screen.findByText("Validation Passed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish to Roblox!" }),
    ).toBeEnabled();
  });

  it("keeps publish disabled unless the recorded state is passed", async () => {
    const validateProject = vi.fn().mockResolvedValue(true);
    useProjectStore.setState({ validateProject });
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    expect(
      await screen.findByRole("button", { name: "Publish to Roblox!" }),
    ).toBeDisabled();
  });

  it("disables publish while an auto-fix mutation is active", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      });
      return true;
    });
    useProjectStore.setState({ validateProject });
    const publishGame = vi.spyOn(publishCommands, "publishGame");
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));
    expect(await screen.findByText("Validation Passed")).toBeInTheDocument();

    act(() => {
      useProjectStore.setState({ fixingIssueId: "stale-warning-proof" });
    });

    expect(
      screen.getByRole("button", { name: "Publish to Roblox!" }),
    ).toBeDisabled();
    expect(publishGame).not.toHaveBeenCalled();
  });
});
