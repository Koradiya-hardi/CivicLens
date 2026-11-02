/**
 * Decorative illustration for the login/register pages: 
 */
export function CapitolArt({ className = "" }: { className?: string }) {
  const columns = Array.from({ length: 11 }, (_, i) => 205 + i * 23);
  const drumColumns = Array.from({ length: 8 }, (_, i) => 279 + i * 11.5);

  return (
    <svg
      viewBox="0 0 640 560"
      className={className}
      role="img"
      aria-label="Illustration of a domed civic building beside a river"
      preserveAspectRatio="xMidYMax meet"
      style={{
        // soften the left/right edges so the scene dissolves into the page
        maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <defs>
        <pattern id="art-windows" width="12" height="14" patternUnits="userSpaceOnUse">
          <rect x="3" y="3" width="4" height="6" rx="1" fill="var(--c-art-window)" opacity="0.35" />
        </pattern>
        <linearGradient id="art-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="art-reflect-mask">
          <rect x="0" y="440" width="640" height="120" fill="url(#art-fade)" />
        </mask>
        <linearGradient id="art-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--c-art-water)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--c-art-water)" stopOpacity="0.05" />
        </linearGradient>

        <g id="art-city">
          {/* far skyline */}
          <g fill="var(--c-art-far)">
            <rect x="12" y="300" width="56" height="140" />
            <rect x="76" y="336" width="42" height="104" />
            <rect x="122" y="276" width="58" height="164" />
            <rect x="470" y="312" width="62" height="128" />
            <rect x="538" y="262" width="46" height="178" />
            <rect x="590" y="320" width="40" height="120" />
          </g>
          <g fill="url(#art-windows)">
            <rect x="12" y="300" width="56" height="140" />
            <rect x="122" y="276" width="58" height="164" />
            <rect x="470" y="312" width="62" height="128" />
            <rect x="538" y="262" width="46" height="178" />
          </g>

          {/* trees */}
          <g fill="var(--c-art-tree)">
            <circle cx="92" cy="428" r="22" /><circle cx="122" cy="434" r="18" /><circle cx="64" cy="436" r="16" />
            <circle cx="520" cy="428" r="22" /><circle cx="552" cy="434" r="18" /><circle cx="490" cy="436" r="16" />
          </g>

          {/* steps and wings */}
          <rect x="160" y="434" width="320" height="12" fill="var(--c-art-mid)" />
          <rect x="170" y="420" width="300" height="14" fill="var(--c-art-mid)" />
          <rect x="150" y="372" width="52" height="48" fill="var(--c-art-mid)" />
          <rect x="438" y="372" width="52" height="48" fill="var(--c-art-mid)" />
          <rect x="150" y="366" width="52" height="8" fill="var(--c-art-near)" />
          <rect x="438" y="366" width="52" height="8" fill="var(--c-art-near)" />

          {/* drum + dome (behind the portico) */}
          <rect x="270" y="286" width="100" height="40" fill="var(--c-art-near)" />
          {drumColumns.map((x) => (
            <rect key={x} x={x} y="292" width="4" height="26" fill="var(--c-art-column)" opacity="0.8" />
          ))}
          <rect x="266" y="280" width="108" height="8" fill="var(--c-art-light)" />
          <path d="M268 282 Q268 208 320 208 Q372 208 372 282 Z" fill="var(--c-art-light)" />
          <path d="M320 208 Q298 238 293 282 M320 208 Q342 238 347 282 M320 208 L320 282" stroke="var(--c-art-near)" strokeWidth="2" fill="none" opacity="0.55" />
          <rect x="311" y="190" width="18" height="20" fill="var(--c-art-near)" />
          <path d="M308 192 Q320 170 332 192 Z" fill="var(--c-art-light)" />
          <rect x="318" y="158" width="4" height="16" fill="var(--c-art-light)" />
          <circle cx="320" cy="156" r="3.5" fill="var(--c-art-column)" />

          {/* main body, columns, pediment */}
          <rect x="190" y="350" width="260" height="70" fill="var(--c-art-near)" />
          {columns.map((x) => (
            <rect key={x} x={x} y="358" width="8" height="58" fill="var(--c-art-column)" opacity="0.85" />
          ))}
          <rect x="186" y="346" width="268" height="8" fill="var(--c-art-light)" />
          <polygon points="252,346 320,314 388,346" fill="var(--c-art-light)" />
          <polygon points="268,343 320,320 372,343" fill="var(--c-art-near)" opacity="0.35" />
        </g>
      </defs>

      {/* water: city reflection fading out, plus ripples */}
      <rect x="0" y="440" width="640" height="120" fill="url(#art-water)" />
      <g mask="url(#art-reflect-mask)" opacity="0.8">
        <use href="#art-city" transform="translate(0,880) scale(1,-1)" />
      </g>
      <g stroke="var(--c-art-column)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35">
        <path d="M60 470h90M180 486h140M360 474h120M500 494h90M120 512h110M300 528h160" />
      </g>

      <use href="#art-city" />

      {/* connector lines + nodes between the tiles and the dome */}
      <g fill="none" stroke="var(--c-tile-ink)" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.75">
        <path d="M372 222 C 400 190 410 130 434 104" />
        <path d="M472 214 C 440 220 410 230 376 244" />
      </g>
      <g fill="var(--c-tile-ink)">
        <circle cx="372" cy="222" r="4" /><circle cx="472" cy="214" r="3.5" />
      </g>

      {/* floating tiles (outer <g> positions, inner <g> bobs) */}
      <g transform="translate(-28 0)">
        <g className="float-slow">
          <rect x="448" y="30" width="88" height="88" rx="20" fill="var(--c-tile)" stroke="var(--c-tile-ink)" strokeOpacity="0.5" />
          <g transform="translate(448 30)" fill="none" stroke="var(--c-tile-ink)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M24 26h40a5 5 0 0 1 5 5v22a5 5 0 0 1-5 5H46l-11 9v-9H24a5 5 0 0 1-5-5V31a5 5 0 0 1 5-5z" />
            <path d="M31 38h26M31 47h16" />
          </g>
        </g>
      </g>
      <g transform="translate(-28 0)">
        <g className="float-slower">
          <rect x="520" y="196" width="80" height="80" rx="18" fill="var(--c-tile)" stroke="var(--c-tile-ink)" strokeOpacity="0.5" />
          <g transform="translate(520 196)" fill="none" stroke="var(--c-tile-ink)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M26 20h18l12 12v26a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3V23a3 3 0 0 1 3-3z" />
            <path d="M44 20v12h12M31 42h18M31 51h18" />
          </g>
        </g>
      </g>
    </svg>
  );
}