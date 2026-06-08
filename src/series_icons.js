// Custom SVG series icons — each 64x64 viewBox, smooth paths

export const SERIES_ICONS = {
  cosmic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="cg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#C084FC"/>
        <stop offset="100%" stop-color="#4C1D95"/>
      </radialGradient>
    </defs>
    <!-- Planet -->
    <circle cx="32" cy="32" r="18" fill="url(#cg1)"/>
    <!-- Ring -->
    <ellipse cx="32" cy="32" rx="28" ry="8" fill="none" stroke="#A78BFA" stroke-width="3" opacity="0.7"/>
    <!-- Stars -->
    <circle cx="10" cy="12" r="2" fill="#FCD34D"/>
    <circle cx="52" cy="8" r="1.5" fill="#E0E7FF"/>
    <circle cx="56" cy="50" r="2" fill="#FCD34D"/>
    <circle cx="8" cy="48" r="1.5" fill="#C084FC"/>
    <circle cx="48" cy="56" r="1.5" fill="#E0E7FF"/>
    <!-- Shimmer on planet -->
    <circle cx="25" cy="26" r="5" fill="rgba(255,255,255,0.15)"/>
    <circle cx="38" cy="38" r="3" fill="rgba(255,255,255,0.08)"/>
  </svg>`,

  dino: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="dg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#4ADE80"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>
    <!-- Dino footprint -->
    <!-- Main toe -->
    <ellipse cx="32" cy="48" rx="10" ry="13" fill="url(#dg1)"/>
    <!-- Left toe -->
    <ellipse cx="16" cy="38" rx="7" ry="10" fill="url(#dg1)" transform="rotate(-25 16 38)"/>
    <!-- Right toe -->
    <ellipse cx="48" cy="38" rx="7" ry="10" fill="url(#dg1)" transform="rotate(25 48 38)"/>
    <!-- Claw tips -->
    <ellipse cx="32" cy="10" rx="4" ry="6" fill="#22C55E"/>
    <ellipse cx="8" cy="22" rx="4" ry="5.5" fill="#22C55E" transform="rotate(-25 8 22)"/>
    <ellipse cx="56" cy="22" rx="4" ry="5.5" fill="#22C55E" transform="rotate(25 56 22)"/>
    <!-- Texture dots -->
    <circle cx="32" cy="44" r="2" fill="rgba(0,0,0,0.15)"/>
    <circle cx="26" cy="50" r="1.5" fill="rgba(0,0,0,0.12)"/>
    <circle cx="38" cy="50" r="1.5" fill="rgba(0,0,0,0.12)"/>
  </svg>`,

  robot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="rg1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38BDF8"/>
        <stop offset="100%" stop-color="#0369A1"/>
      </linearGradient>
    </defs>
    <!-- Robot head -->
    <rect x="14" y="18" width="36" height="28" rx="6" fill="url(#rg1)"/>
    <!-- Antenna -->
    <rect x="30" y="6" width="4" height="12" rx="2" fill="#7DD3FC"/>
    <circle cx="32" cy="6" r="4" fill="#FCD34D"/>
    <!-- Eyes - glowing -->
    <rect x="19" y="26" width="10" height="7" rx="2" fill="#0C4A6E"/>
    <rect x="35" y="26" width="10" height="7" rx="2" fill="#0C4A6E"/>
    <rect x="21" y="27" width="6" height="5" rx="1" fill="#7DD3FC"/>
    <rect x="37" y="27" width="6" height="5" rx="1" fill="#7DD3FC"/>
    <!-- Mouth grill -->
    <rect x="20" y="38" width="24" height="4" rx="2" fill="#0C4A6E"/>
    <rect x="23" y="38" width="3" height="4" fill="#38BDF8"/>
    <rect x="30" y="38" width="3" height="4" fill="#38BDF8"/>
    <rect x="37" y="38" width="3" height="4" fill="#38BDF8"/>
    <!-- Ear bolts -->
    <circle cx="14" cy="32" r="4" fill="#075985"/>
    <circle cx="50" cy="32" r="4" fill="#075985"/>
    <!-- Body -->
    <rect x="20" y="46" width="24" height="12" rx="4" fill="#075985"/>
    <circle cx="32" cy="52" r="4" fill="#FCD34D"/>
  </svg>`,

  magic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs>
      <radialGradient id="mg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FCA5A5"/>
        <stop offset="100%" stop-color="#7F1D1D"/>
      </radialGradient>
    </defs>
    <!-- Wand -->
    <rect x="28" y="12" width="6" height="36" rx="3" fill="#991B1B" transform="rotate(-30 32 32)"/>
    <!-- Wand tip star -->
    <polygon points="32,4 34,11 41,11 35,15 37,22 32,18 27,22 29,15 23,11 30,11" fill="#FCD34D"/>
    <!-- Sparkles -->
    <circle cx="50" cy="16" r="3" fill="#FCA5A5" opacity="0.9"/>
    <circle cx="48" cy="10" r="1.5" fill="#FCD34D"/>
    <circle cx="55" cy="20" r="1.5" fill="#FCD34D"/>
    <circle cx="14" cy="44" r="3" fill="#F472B6" opacity="0.9"/>
    <circle cx="10" cy="40" r="1.5" fill="#FCD34D"/>
    <circle cx="18" cy="48" r="1.5" fill="#FCD34D"/>
    <!-- Magic orb at base -->
    <circle cx="38" cy="46" r="8" fill="url(#mg1)" opacity="0.85"/>
    <circle cx="36" cy="43" r="3" fill="rgba(255,255,255,0.25)"/>
    <!-- Rune marks -->
    <text x="34" y="48" font-size="8" fill="#FCA5A5" opacity="0.7" font-family="serif">✦</text>
  </svg>`,
}
