/**
 * AEROFUSION — design tokens.
 *
 * The ONE place for colour, spacing, timing and motion (type: src/typography/). Every component and scene
 * reads from here; CSS reads the same values as custom properties written by applyTokens().
 *
 * Light rule: the screen never gets bright. Time of day changes the background's HUE,
 * not its brightness. Everything bright in the world is either pollution or people.
 */

/**
 * The particle's look — an experiment switch. 'cream': a pale dust grain crusted with soot (black
 * pores, seams and patches), which reads as pollution and stands out on the dark. 'ember': the
 * International Orange ball. Everything drawn as "the particle" follows this: the story's ember,
 * the gathered blob, the hero's ball, the logo's blob and the cursor.
 */
export const PARTICLE_LOOK = 'cream';

const PARTICLE_LOOKS = {
  ember: {
    shadow: '#4a1402', // matte shadow side of the ball
    base: '#ff4d00', // = color.accent, International Orange
    lit: '#ff7f3a',
    rim: '#ffc09a', // light catching the fuzz on the lit edge
    speck: '#ffd9a0', // warm-yellow dots in the loose cluster / burst
    soot: '#140d0a', // black accents (unused: sootMix 0)
    sootMix: 0,
    glow: '#ff4d00', // the haze behind the ball
    hot: '#ffa252', // burning: the ember edge of the ignited ball (= the video's spark glow)
    white: '#fff4e0', // burning: the white-hot centre
  },
  cream: {
    shadow: '#61574c', // warm grey shadow side: still separates from the black
    base: '#d8cab0', // sand cream
    lit: '#eee4d1',
    rim: '#fffaf0',
    speck: '#f4e6c8', // pale dots in the loose cluster / burst
    soot: '#14110f', // the black accents: pores, seams, soot patches and flecks
    sootMix: 1,
    glow: '#e8d9bf',
    hot: '#ffa252', // it still burns like the ember (the video's spark)
    white: '#fff4e0',
  },
};

export const tokens = {
  color: {
    /** Background per time of day. Scroll interpolates between these. */
    sky: {
      afternoon: '#13283A',
      dusk: '#1A1630',
      /** The renders' own night: deep violet, never neutral black. */
      night: '#0a0820',
      /** A smog morning: warm, dark grey (Scene 5). */
      dawn: '#232129',
      /** The opening (the hero) and the dashboard's field: matte charcoal (the 60 % base). */
      canvas: '#121212',
    },

    /*
     * The site palette (new frontend proposal/color_theme.txt): 60 % matte charcoal, 30 % putty
     * cream, 10 % International Orange. Orange is the one call to action, live dots and the brand
     * ball — never large fills, glows or paragraph text.
     */
    surface: '#1A1A1A',
    border: '#2A2A2A',
    stone: '#9A968E',
    /** The quieter accent: warm sand cream, a step warmer than the ink. Small marks only. */
    cream: '#E8D9BF',
    accent: '#FF4D00',
    accentHover: '#E04300',

    /** RESERVED: the particle, fire and pollution. Nothing else may use it. */
    ember: '#ff8a3d',
    /** Hot core of fire / sparks (still pollution-side). */
    emberHot: '#ffc27a',
    /** The few warm-yellow specks inside the particle. */
    speck: '#ffd78f',

    /** People-light: windows and street lamps. Softer and paler than ember. */
    lamp: '#f3d39b',
    /** The horizon band. Muted and warm, never ember. */
    horizon: '#d99a66',
    /** The clock's moon. */
    moon: '#c9d2e3',
    /** Scene 5's mixing-layer ceiling line. */
    ceiling: '#f1e2c9',

    /**
     * Text: a warm cream. Its quieter tones are mixed INTO the current sky (CSS color-mix with
     * --sky), not faded toward grey, so secondary text takes on each scene's light.
     */
    ink: '#F2EFE9', // putty cream
    inkDim: 62, // % of ink in the mix with the sky
    inkFaint: 36,
    /** Scene 5's clinical accent (the airway's rim). */
    clinical: '#e0a0a8',

    /**
     * Shadows are the sky pushed darker, never grey. Used as color-mix(sky, shadow N%).
     * Pure black mixed into a hued sky keeps the hue.
     */
    shadow: '#000000',
    /** Atmospheric-perspective lift for far silhouettes (mixed into the sky). */
    distance: '#8a90b4',
  },

  /*
   * TYPE lives in src/typography/ (fonts, fluid scale, h1/h2/p rules) — the one place it is
   * defined. Nothing here sets a font or a font size.
   */

  space: {
    /** Screen-edge gutter. 16px floor on phones. */
    gutter: 'clamp(16px, 3vw, 32px)',
    xs: '4px',
    s: '8px',
    m: '16px',
    l: '32px',
    xl: '64px',
  },

  timing: {
    /**
     * ScrollTrigger scrub: true = timelines track the scroll exactly. Lenis already smooths the
     * scroll itself; a second smoothing on top makes everything trail the scroll, late and
     * rubbery, and lets canvases and DOM drift apart by a frame.
     */
    scrub: true,
    /** Lenis smooth scroll (src/core/smoothScroll.js). lerp: lower = silkier, more glide. */
    smoothScroll: { lerp: 0.09, wheelMultiplier: 1 },
    /** Default fade/move durations for non-scrubbed UI (seconds). */
    fade: 0.6,
    markerSwap: 0.5,
    /** Film grain repaint rate. */
    grainFps: 12,
    /** Calm pacing: how far a scene's 0..1 timeline is allowed to move per 100vh. */
    defaultSceneLength: 5,
  },

  /**
   * Day cycle used when a scene lets the sky follow the clock (atmo.followClock = 1).
   * [minutes since midnight, value]. Colours are names from color.sky.
   */
  dayCycle: {
    sky: [
      [0, 'night'],
      [300, 'night'], // 5:00
      [375, 'dawn'], // 6:15
      [480, 'dawn'], // 8:00
      [660, 'afternoon'], // 11:00
      [990, 'afternoon'], // 16:30
      [1095, 'dusk'], // 18:15
      [1200, 'night'], // 20:00
      [1440, 'night'],
    ],
    /** Horizon glow strength: strongest in the afternoon, fades through dusk, gone at night. */
    horizon: [
      [0, 0],
      [330, 0],
      [390, 0.22],
      [540, 0.5],
      [780, 1],
      [990, 0.9],
      [1095, 0.45],
      [1185, 0],
      [1440, 0],
    ],
  },

  horizon: {
    /** Thin band. Height of the full falloff, not of the bright edge. */
    height: '18vh',
    /** Peak opacity of the band at strength 1. Keeps the screen from ever getting bright. */
    peak: 0.5,
  },

  particle: {
    /** Tones (light from the top-left), from the look chosen by PARTICLE_LOOK above. */
    tones: PARTICLE_LOOKS[PARTICLE_LOOK],
    /** Flat dots used by the loose cluster and the burst (the body is one drawn shape). */
    count: 900,
    countMobile: 700,
    /** Share of points that are warm-yellow specks. */
    speckShare: 0.035,
    /** On-screen diameter in CSS px. */
    diameter: { min: 60, max: 90, vw: 5.6 },
    diameterMobile: { min: 40, max: 52, vw: 11 },
    /** Canvas is this many diameters wide so bursts and loose clusters have room. */
    canvasScale: 6,
    swirlSpeed: 1,
    wobble: 0.022,
    breathe: 0.03,
    /** Direction of the brighter rim (screen space, x right, y up). */
    rimLight: [-0.55, 0.83],
    /** Faint warm haze behind the ball. Kept low: the reference particle is matte, not lit. */
    glow: 0.22,
  },

  dust: { count: 38, countMobile: 22, alpha: [0.06, 0.26], size: [0.5, 1.5], drift: 0.006 },

  grain: { opacity: 0.075, tile: 180 },
  vignette: { strength: 0.85 },

  motion: {
    /** Parallax distance multiplier when prefers-reduced-motion is on. */
    reducedParallax: 0.3,
    /** Particle/dust internal animation speed when reduced. */
    reducedTimeScale: 0.15,
  },

  z: { sky: 0, horizon: 1, scene: 2, vignette: 40, grain: 41, hud: 50 },

  breakpoints: { mobile: 640 },
};

/* ---------------------------------------------------------------- CSS bridge -- */

const hexToRgbTriplet = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** Writes the tokens as CSS custom properties on :root. (Fonts: src/typography/.) */
export function applyTokens(root = document.documentElement) {
  const { color: c, space: s, z } = tokens;
  const vars = {
    '--sky': c.sky.night,
    '--horizon': '0',
    '--c-ember': c.ember,
    '--c-ember-rgb': hexToRgbTriplet(c.ember),
    '--c-ember-hot': c.emberHot,
    '--c-lamp': c.lamp,
    '--c-lamp-rgb': hexToRgbTriplet(c.lamp),
    '--c-horizon-rgb': hexToRgbTriplet(c.horizon),
    '--c-moon': c.moon,
    '--c-ceiling': c.ceiling,
    '--c-ceiling-rgb': hexToRgbTriplet(c.ceiling),
    '--c-ink': c.ink,
    '--c-ink-rgb': hexToRgbTriplet(c.ink),
    '--c-canvas': c.sky.canvas,
    '--c-surface': c.surface,
    '--c-border': c.border,
    '--c-stone': c.stone,
    '--c-cream': c.cream,
    '--c-accent': c.accent,
    '--c-accent-rgb': hexToRgbTriplet(c.accent),
    '--c-accent-hover': c.accentHover,
    '--c-ink-dim': `color-mix(in srgb, ${c.ink} ${c.inkDim}%, var(--sky))`,
    '--c-ink-faint': `color-mix(in srgb, ${c.ink} ${c.inkFaint}%, var(--sky))`,
    '--c-clinical': c.clinical,
    '--c-shadow': c.shadow,
    '--c-distance': c.distance,
    '--gutter': s.gutter,
    '--space-xs': s.xs,
    '--space-s': s.s,
    '--space-m': s.m,
    '--space-l': s.l,
    '--space-xl': s.xl,
    '--horizon-height': tokens.horizon.height,
    '--horizon-peak': String(tokens.horizon.peak),
    '--grain-opacity': String(tokens.grain.opacity),
    '--vignette': String(tokens.vignette.strength),
    '--dur-fade': `${tokens.timing.fade}s`,
    '--z-sky': z.sky,
    '--z-horizon': z.horizon,
    '--z-scene': z.scene,
    '--z-vignette': z.vignette,
    '--z-grain': z.grain,
    '--z-hud': z.hud,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, String(v));
}
