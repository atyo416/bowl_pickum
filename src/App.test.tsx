import { beforeEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "./App";
beforeEach(() => {
  cleanup();
  localStorage.clear();
});
it("renders overview and participant selector", () => {
  render(<App />);
  expect(screen.getByText(/Your picks\./)).toBeInTheDocument();
  expect(screen.getByLabelText("Participant")).toHaveValue("p1");
});
it("saves a bowl draft with visible feedback and survives remount", () => {
  const view = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Bowl picks" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByRole("status")).toHaveTextContent("Draft saved");
  view.unmount();
  render(<App />);
  expect(
    JSON.parse(localStorage.getItem("bowl-room:v1")!).entries[0].bowlSubmission,
  ).toBeDefined();
});
it("shows bracket rounds, champion and tiebreaker", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "CFP bracket" }));
  expect(
    screen.getByRole("heading", { name: "Quarterfinals" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Championship combined points")).toHaveValue(52);
});
it("switches to independent incomplete participant and rejects submission", () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Participant"), {
    target: { value: "p5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "CFP bracket" }));
  fireEvent.click(screen.getByRole("button", { name: /Submit bracket/ }));
  expect(screen.getByRole("alert")).toHaveTextContent("Complete every pick");
});
it("renders weighted leaderboard with separate point columns", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Leaderboard" }));
  expect(
    screen.getByRole("columnheader", { name: "Bowl pts" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("columnheader", { name: "CFP pts" }),
  ).toBeInTheDocument();
});
