import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectInfo } from "../../types/project";
import { PublishPage } from "./PublishPage";

const originalProjectStore = useProjectStore.getState();
const project: ProjectInfo = {
  name: "Authority Availability Contract",
  path: "D:/RobloxForge/AuthorityAvailability",
  template: "obby",
  createdAt: "2026-07-15T00:00:00.000Z",
};

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

beforeEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  useProjectStore.setState({ project });
  vi.spyOn(robloxAuthorityCommands, "getState");
  vi.spyOn(robloxAuthorityCommands, "publishProject");
});

afterEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  vi.restoreAllMocks();
});

describe("PublishPage Desktop authority availability", () => {
  it("offers no OAuth or publish action on a direct browser route", () => {
    render(<PublishPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop required/i);
    expect(screen.queryByRole("button", { name: /Log In with Roblox/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish verified target/i }))
      .not.toBeInTheDocument();
    expect(robloxAuthorityCommands.getState).not.toHaveBeenCalled();
    expect(robloxAuthorityCommands.publishProject).not.toHaveBeenCalled();
  });

  it("keeps the Desktop-required boundary visible when no project is open", () => {
    useProjectStore.setState({ project: null });
    render(<PublishPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop required/i);
    expect(screen.getByRole("heading", { name: "No project is open" }))
      .toBeInTheDocument();
    expect(robloxAuthorityCommands.getState).not.toHaveBeenCalled();
  });

  it("shows a Desktop state-read failure without falling back to browser auth", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.getState).mockRejectedValueOnce(
      new Error("Desktop target registry is unavailable."),
    );
    render(<PublishPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Desktop target registry is unavailable.",
    );
    expect(screen.queryByRole("button", { name: /Log In with Roblox/i }))
      .not.toBeInTheDocument();
    expect(robloxAuthorityCommands.publishProject).not.toHaveBeenCalled();
  });
});
