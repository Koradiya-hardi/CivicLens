import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const login = vi.fn();
const register = vi.fn();
const screen = within(document.body);
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ login, register }) }));

import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

const Where = () => <div data-testid="loc">{useLocation().pathname}</div>;
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );

beforeEach(() => { login.mockReset(); register.mockReset(); });

describe("Login page (restyled)", () => {
  it("renders inside the shared layout, with decorative layers hidden from screen readers", () => {
    const { container } = renderAt("/login");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    const decorative = container.querySelectorAll('[aria-hidden="true"]');
    expect(decorative.length).toBe(2);
    expect(screen.queryByText(/radial-gradient/)).not.toBeInTheDocument();
  });
  it("submits credentials and goes to the dashboard", async () => {
    login.mockResolvedValue(undefined);
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(login).toHaveBeenCalledWith("a@b.com", "secret123");
    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });
  it("shows the server's error as an alert and stays on the page", async () => {
    login.mockRejectedValue({ response: { data: { message: "Invalid email or password" } } });
    renderAt("/login");
    await userEvent.type(screen.getByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongwrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByTestId("loc")).toHaveTextContent("/login");
    expect(screen.getByRole("button", { name: "Log in" })).not.toBeDisabled();
  });
  it("links to register", async () => {
    renderAt("/login");
    await userEvent.click(screen.getByRole("link", { name: "Register" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
});

describe("Register page (restyled)", () => {
  it("sends name, email and password, then goes to the dashboard", async () => {
    register.mockResolvedValue(undefined);
    renderAt("/register");
    await userEvent.type(screen.getByLabelText("Name"), "Jane Doe");
    await userEvent.type(screen.getByLabelText("Email"), "jane@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(register).toHaveBeenCalledWith("Jane Doe", "jane@x.com", "longenough1");
    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });
  it("shows a duplicate-email error from the server", async () => {
    register.mockRejectedValue({ response: { data: { message: "An account with this email already exists" } } });
    renderAt("/register");
    await userEvent.type(screen.getByLabelText("Name"), "J");
    await userEvent.type(screen.getByLabelText("Email"), "jane@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "longenough1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });
  it("password field enforces the 8-character minimum", () => {
    renderAt("/register");
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
  });
});