// Web app-aligned design tokens for Educare LMS Mobile
// Synced with apps/web/src/app/globals.css brand tokens

export const Colors = {
  brand: {
    // Core brand — exact match to web globals.css
    blue: '#0162B1',       // --color-brand-blue
    blueDark: '#014D8A',   // --color-brand-blue-dark
    blueAccent: '#1A7FD4', // --color-brand-blue-light
    blueLight: '#E8F2FA',  // light tint for badges & active states

    red: '#EE1B24',        // --color-brand-red (Educare Red)
    redDark: '#C41219',    // --color-brand-red-dark
    redLight: '#FDE8E9',   // light tint for urgent badges

    // Semantic accents
    emerald: '#16A34A',    // --color-success
    emeraldLight: '#ECFDF5',
    amber: '#D97706',      // --color-warning
    amberLight: '#FFFBEB',
    indigo: '#6366F1',
    indigoLight: '#EEF2FF',
    purple: '#6366F1',
  },
  surface: {
    background: '#FAFAF8', // --color-surface
    card: '#FFFFFF',
    subtle: '#F4F4F1',     // --color-surface-2
    secondary: '#EBEBE7',
  },
  border: {
    default: '#E8E8E4',    // --color-border-soft
    subtle: '#E8E8E4',
    light: '#F0F0ED',
    focus: '#0162B1',
  },
  text: {
    primary: '#1A1A2E',    // --color-text-primary
    secondary: '#5A5A72',  // --color-text-secondary
    muted: '#9494A8',      // --color-text-muted
    inverse: '#FFFFFF',
  },
  status: {
    success: '#16A34A',
    successLight: '#ECFDF5',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    error: '#EE1B24',
    errorLight: '#FDE8E9',
    info: '#0162B1',
    infoLight: '#E8F2FA',
  },
};

// Shadows — subtle, professional (web-like crisp cards, not neon glows)
export const Shadows = {
  xs: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  // Subtle branded glow (used sparingly)
  glowBlue: {
    shadowColor: '#0162B1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Typography scale
export const Typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 12, lineHeight: 18 },
  base: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 15, lineHeight: 22 },
  lg: { fontSize: 17, lineHeight: 24 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 28, lineHeight: 36 },
};

// Spacing scale
export const Space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32,
};

// Border radii
export const Radii = {
  sm: 6, md: 10, lg: 14, xl: 18, '2xl': 24, full: 9999,
};
