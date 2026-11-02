import type { ReactNode } from "react";
import { LogoMark } from "@/components/LogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CapitolArt } from "@/components/auth/CapitolArt";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** The "Don't have an account? Register" line under the form. */
  footer: ReactNode;
}

const FEATURES = [
  {
    label: "Find Resources",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  {
    label: "Ask Questions",
    icon: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  },
  {
    label: "Build a Stronger Community",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16.5 14.6c2.7.1 4.5 1.8 4.5 4.4" />
      </>
    ),
  },
];

/**
 * Shared shell for login and register: brand + feature highlights on the
 * left, the form card in the middle, an illustration on the right.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundImage: "linear-gradient(135deg, var(--c-auth-from) 0%, var(--c-auth-via) 55%, var(--c-auth-to) 100%)" }}
    >
      {/* Soft curved shapes in the corners (decorative) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="wave-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--c-wave))" stopOpacity="0.38" />
            <stop offset="1" stopColor="rgb(var(--c-wave))" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        <path d="M0 0H430C390 120 230 215 0 305Z" fill="url(#wave-fill)" />
        <path d="M430 0C390 120 230 215 0 305" fill="none" stroke="rgb(var(--c-wave))" strokeOpacity="0.5" strokeWidth="2" />
        <path d="M0 900V765C160 705 305 800 465 900Z" fill="url(#wave-fill)" />
        <path d="M1440 515C1300 640 1150 800 1000 900H1440Z" fill="url(#wave-fill)" />
        <path d="M1440 515C1300 640 1150 800 1000 900" fill="none" stroke="rgb(var(--c-wave))" strokeOpacity="0.55" strokeWidth="2" />
      </svg>

      <ThemeToggle className="absolute right-4 top-4 z-20" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1500px] items-center gap-6 px-4 py-10 lg:grid-cols-[1fr_minmax(380px,440px)_1fr] lg:px-8">
        {/* Left: brand + highlights */}
        <section className="hidden lg:block lg:justify-self-end lg:pr-6 xl:pr-12">
          <div className="max-w-sm">
            <div className="flex items-center gap-3.5">
              <LogoMark size={64} />
              <span className="text-4xl font-extrabold tracking-tight text-ink">
                Civic<span className="bg-gradient-to-r from-accent to-[#5b8def] bg-clip-text text-transparent">Lens</span>
              </span>
            </div>
            <h2 className="mt-10 text-3xl font-semibold leading-tight text-ink">
              Smarter insights.
              <br />
              Stronger communities.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Discover, explore, and engage with public resources — all in one place.
            </p>
            <ul className="mt-10 flex gap-6">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex w-24 flex-col items-center gap-2.5 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/60 text-accent backdrop-blur">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {f.icon}
                    </svg>
                  </span>
                  <span className="text-xs font-medium leading-snug text-ink-soft">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Middle: the form card, with a gradient hairline border */}
        <main className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2.5 lg:hidden">
            <LogoMark size={36} />
            <span className="text-2xl font-extrabold tracking-tight text-ink">
              Civic<span className="bg-gradient-to-r from-accent to-[#5b8def] bg-clip-text text-transparent">Lens</span>
            </span>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-accent/70 via-accent/10 to-accent-2/40 p-px shadow-2xl shadow-black/30">
            <div className="rounded-[calc(1.5rem-1px)] bg-surface/85 p-8 backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <LogoMark size={30} />
                <span className="font-extrabold text-ink">CivicLens</span>
              </div>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{subtitle}</p>

              {children}

              <p className="mt-6 text-center text-sm text-ink-soft">{footer}</p>
            </div>
          </div>
        </main>

        {/* Right: illustration */}
        <aside className="hidden lg:block lg:-ml-10 lg:w-[112%] lg:max-w-[640px] lg:justify-self-start">
          <CapitolArt className="w-full" />
        </aside>
      </div>
    </div>
  );
}