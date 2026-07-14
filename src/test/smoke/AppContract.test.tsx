import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { useUserStore } from "../../stores/userStore";

const { pendingRoute } = vi.hoisted(() => ({
  pendingRoute: new Promise<never>(() => undefined),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const router = await importOriginal<typeof import("react-router-dom")>();

  return {
    ...router,
    Routes: function SuspendedRoutes() {
      throw pendingRoute;
    },
  };
});

describe("App loading contract", () => {
  const initialProfile = useUserStore.getState().profile;

  beforeEach(() => {
    useUserStore.setState({
      profile: { ...initialProfile, hasCompletedOnboarding: true },
    });
  });

  afterEach(() => {
    useUserStore.setState({ profile: initialProfile });
  });

  it("exposes the RobloxForge loading fallback as an accessible status", () => {
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("status", { name: "Loading RobloxForge" }),
    ).toBeInTheDocument();
  });
});
