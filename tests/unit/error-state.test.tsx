import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";

it("offers keyboard retry without exposing the original error message", async () => {
  const retry = vi.fn();
  render(<ErrorPage error={new Error("private connection details")} retry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("다시 시도");
  expect(screen.queryByText("private connection details")).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.tab();
  expect(screen.getByRole("button", { name: "다시 시도" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "보드로 이동" })).toHaveAttribute("href", "/board");
});
