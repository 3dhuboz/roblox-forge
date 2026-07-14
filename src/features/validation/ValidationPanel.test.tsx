import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValidationPanel } from "./ValidationPanel";

describe("ValidationPanel", () => {
  it("does not present an empty not-run result as passed", () => {
    render(
      <ValidationPanel issues={[]} state="not_run" error={null} />,
    );

    expect(screen.getByText("Validation Not Run")).toBeInTheDocument();
    expect(screen.queryByText("Validation Passed")).not.toBeInTheDocument();
    expect(screen.queryByText(/ready to publish/i)).not.toBeInTheDocument();
  });

  it("renders an empty failed run as an alert instead of success", () => {
    render(
      <ValidationPanel
        issues={[]}
        state="failed"
        error="Desktop validation is unavailable."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Desktop validation is unavailable.",
    );
    expect(screen.queryByText("Validation Passed")).not.toBeInTheDocument();
    expect(screen.queryByText(/ready to publish/i)).not.toBeInTheDocument();
  });

  it("shows ready copy only for an explicitly passed run", () => {
    render(<ValidationPanel issues={[]} state="passed" error={null} />);

    expect(screen.getByText("Validation Passed")).toBeInTheDocument();
    expect(screen.getByText(/ready to publish/i)).toBeInTheDocument();
  });
});
