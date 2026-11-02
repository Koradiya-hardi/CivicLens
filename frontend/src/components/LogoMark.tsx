/** The CivicLens "lens" mark: a rounded gradient square with an eye. Scales with `size`. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-[#9b7bff] to-[#5b8def]"
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.64} height={size * 0.64} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" fill="#fff" />
      </svg>
    </span>
  );
}