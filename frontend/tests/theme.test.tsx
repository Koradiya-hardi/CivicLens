import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { setTheme, toggleTheme, useTheme } from "../src/lib/theme";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { api, authRedirect } from "../src/lib/api";
import LoginPage from "../src/pages/LoginPage";
import RegisterPage from "../src/pages/RegisterPage";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn(), user: null, loading: false }),
}));

const htmlTheme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  localStorage.clear();
  setTheme("dark");
});

describe("theme store", () => {
  it("setTheme updates <html data-theme> and remembers the choice", () => {
    setTheme("light");
    expect(htmlTheme()).toBe("light");
    expect(localStorage.getItem("civiclens_theme")).toBe("light");
    toggleTheme();
    expect(htmlTheme()).toBe("dark");
    expect(localStorage.getItem("civiclens_theme")).toBe("dark");
  });

  it("every component using the hook re-renders together", () => {
    const A = () => <p>a:{useTheme().theme}</p>;
    const B = () => <p>b:{useTheme().theme}</p>;
    render(<><A /><B /></>);
    expect(screen.getByText("a:dark")).toBeInTheDocument();
    act(() => setTheme("light"));
    expect(screen.getByText("a:light")).toBeInTheDocument();
    expect(screen.getByText("b:light")).toBeInTheDocument();
  });

  it("survives blocked storage (private mode)", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => setTheme("light")).not.toThrow();
    expect(htmlTheme()).toBe("light");
    spy.mockRestore();
  });
});

describe("ThemeToggle", () => {
  it("labels the button with where it will take you, and flips the theme", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Switch to light mode" });
    await userEvent.click(btn);
    expect(htmlTheme()).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(htmlTheme()).toBe("dark");
  });

  it("appears on the login and register pages", () => {
    const { unmount } = render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
    unmount();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeInTheDocument();
  });

  it("the password field can be revealed and hidden again", async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});

describe("401 handling", () => {
  // run the real response interceptor with a fake failed request
  const fail401 = async (url: string, token: boolean) => {
    if (token) localStorage.setItem("civiclens_token", "t");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (api.interceptors.response as any).handlers[0].rejected;
    await handler({ response: { status: 401 }, config: { url } }).catch(() => {});
  };

  it("an expired session clears the token and goes to /login", async () => {
    authRedirect.toLogin = vi.fn();
    await fail401("/dashboard", true);
    expect(localStorage.getItem("civiclens_token")).toBeNull();
    expect(authRedirect.toLogin).toHaveBeenCalledTimes(1);
  });

  it("a wrong password on the login form does NOT redirect (it just shows the error)", async () => {
    authRedirect.toLogin = vi.fn();
    await fail401("/auth/login", true);
    expect(authRedirect.toLogin).not.toHaveBeenCalled();
  });

  it("no token held (visitor) means no redirect", async () => {
    authRedirect.toLogin = vi.fn();
    await fail401("/dashboard", false);
    expect(authRedirect.toLogin).not.toHaveBeenCalled();
  });
});