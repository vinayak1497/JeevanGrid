---
name: Civic Solace
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#414943'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#717972'
  outline-variant: '#c1c9c1'
  surface-tint: '#3b674e'
  primary: '#002c19'
  on-primary: '#ffffff'
  primary-container: '#15432c'
  on-primary-container: '#81b092'
  inverse-primary: '#a1d2b2'
  secondary: '#2a6866'
  on-secondary: '#ffffff'
  secondary-container: '#aeebe8'
  on-secondary-container: '#2f6c6a'
  tertiary: '#002745'
  on-tertiary: '#ffffff'
  tertiary-container: '#023d67'
  on-tertiary-container: '#7ea8d8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bdeecd'
  primary-fixed-dim: '#a1d2b2'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#224f37'
  secondary-fixed: '#b1eeeb'
  secondary-fixed-dim: '#95d1cf'
  on-secondary-fixed: '#00201f'
  on-secondary-fixed-variant: '#084f4e'
  tertiary-fixed: '#d0e4ff'
  tertiary-fixed-dim: '#9fcafc'
  on-tertiary-fixed: '#001d35'
  on-tertiary-fixed-variant: '#174974'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-num:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-xxs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  gutter-mobile: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin-mobile: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  container-max: 80rem
---

## Brand & Style

This design system embodies a calm, authoritative civic presence tailored for high-stress crisis response and public safety. In moments of emergency, panic is the adversary; the interface serves as a steady anchor. By rejecting the sensationalist, high-saturation tropes of typical warning systems and commercial dashboards, the visual tone conveys institutional reliability, deliberate composure, and immediate clarity. 

The aesthetic sits at the intersection of **Civic Modernism** and **Tactile Restraint**, influenced by classical municipal cartography, editorial typography, and the understated physical clarity of high-integrity industrial safety hardware. It relies on serene, paper-like surfaces, architectural rhythm, and deliberate contrast hierarchies that remain legible under direct sunlight, low network conditions, and severe user cognitive load.

Key tenets:
- **Calm Authority:** Information is structured with quiet confidence. Alerts use restrained urgency rather than flashing panic cues.
- **Universal Dignity:** Public-service interfaces must never feel transactional, gamified, or technological for its own sake.
- **Physical Precision:** Soft natural whites, micro-hairlines, and deep mineral pigments give components a physical, printed gravitas.

## Colors

The palette is derived from natural mineral tones and institutional architectural finishes, avoiding harsh synthetic primaries.

- **Background Canvas (`#fbfbf9`):** A warm, off-white ivory surface reduces eye fatigue across long operational cycles and simulates the warmth of archival paper.
- **Primary Deep Forest Green (`#15432c` & `#1b5336`):** The foundation of municipal authority, stability, and growth. Applied to primary CTAs, major navigation elements, and trusted institutional confirmations.
- **Secondary Muted Teal (`#2d6a68`):** Evokes water, infrastructure, and calm logistical execution. Used for secondary actions, informational badges, and supportive status indicators.
- **Tertiary Civic Blue (`#1e4e79`):** Reserved for institutional notices, official dispatch updates, civic services, and public registry links.
- **Neutral Charcoal Slate (`#1e293b`):** Delivers optimal reading comfort and high-contrast accessibility (WCAG AAA) across text, replacing harsh absolute black.
- **Restrained Emergency Signals:** 
  - `Amber Caution (#d97706)`: Advisory notices, weather warnings, and supply shortages.
  - `Emergency Coral-Red (#b91c1c)`: Strict SOS dispatches, immediate evacuation routes, and life-critical triage triggers. Never applied as a background flood; deployed strictly through sharp indicators, precise border accents, and high-contrast chips.

## Typography

The typography pairing reconciles human approachability with functional precision.

- **Headlines (Plus Jakarta Sans):** Features welcoming curves balanced by a structured geometric chassis, delivering clarity without cold sterility. Headings maintain tight letter-spacing to enhance perceptual authority and compact visual footprints during emergency alerts.
- **Body & Data (Inter):** Leverages tall x-height, open apertures, and specialized contextual alternate figures. Critical for coordinates, helpline routing, and field manual readability on low-cost screens.
- **Tabular Figures & Metrics:** For emergency coordinate displays, survivor roll calls, and medical stock figures, numerical characters must always activate tabular numerals (`tnum`) to maintain vertical alignment and immediate scanning integrity.

## Layout & Spacing

The layout is built upon an 8pt base grid with an emphasis on calm, structured breathing room. Dense, clustered layouts exacerbate panic; deliberate spacing establishes visual composure and reinforces actionable hierarchy.

- **Grid Architecture:** 
  - Desktop (≥1024px): 12-column layout with fixed 32px gutters and max-width clamping at 1280px (`80rem`). Main operational tools take an 8/4 split (primary operational feed vs. contextual status tray).
  - Tablet (768px - 1023px): 8-column layout with 24px gutters, dynamic horizontal margin of 32px.
  - Mobile (<768px): 4-column layout with 16px gutters and 16px margins. Primary actions and critical alerts sit sticky within the safe area touch zone.
- **Component Padding Rhythms:** Cards, dialogs, and alert blocks prioritize generous vertical padding (24px to 32px on desktop; 16px to 20px on mobile) to separate complex instructions into digestible mental chunks.

## Elevation & Depth

This design system avoids theatrical drop shadows and floating synthetic cards, relying instead on **tactile tonal layering** and **hairline boundaries** reminiscent of physical parchment and precision instruments.

- **Atmospheric Layering:** 
  - Base level: `#fbfbf9` (Warm Ivory Canvas).
  - Resting Card/Container: `#ffffff` (Pure White), framed with a crisp `1px solid #e4e4dc` border.
  - Recessed Utility/Meta Containers: `#f4f4f0` (Subtle off-white warm grey) for ancillary status badges and search controls.
- **Shadow Profile:**
  - Elevation 1 (Resting surfaces, cards): A single diffused ambient floor: `0 1px 3px rgba(30, 41, 59, 0.04), 0 1px 2px rgba(30, 41, 59, 0.02)`.
  - Elevation 2 (Dropdown menus, flying toolbars): `0 4px 12px -2px rgba(30, 41, 59, 0.06), 0 2px 6px -1px rgba(30, 41, 59, 0.03)`.
  - Elevation 3 (Critical SOS Sheets, Modals): `0 16px 32px -4px rgba(30, 41, 59, 0.08), 0 4px 12px -2px rgba(30, 41, 59, 0.04)` combined with a soft `#1e293b` backdrop overlay at 35% opacity.
- **Borders as Structure:** Elevation changes are constantly reinforced by subtle, low-contrast 1px micro-borders (`#e4e4dc`). This guarantees separation even on low-grade LCD panels or inverted accessibility displays.

## Shapes

The geometric vernacular uses restrained, structural curves:
- **Default Elements:** 8px (`0.5rem`) for buttons, text fields, and micro-badges, establishing an approachable but solid profile.
- **Surfaces & Cards:** 16px (`1rem`) to 24px (`1.5rem`) for high-level informational card clusters and regional status containers, producing a warm civic framing without slipping into juvenile or hyper-casual roundedness.
- **Full Radius (Pill):** Strictly limited to triage indicators, status chips, and urgent broadcast pills to mimic real-world emergency beacons and signage tags.

## Components

### Buttons
- **Primary (Institutional Action):** Background `#15432c`, text `#ffffff`, border radius 8px. Hover shifts to `#1b5336`. Focus ring is 2px `#15432c` with a 2px `#fbfbf9` offset.
- **Secondary (Civic Utility):** Background `#ffffff`, border `1px solid #cbd5e1`, text `#1e293b`. Hover background `#f4f4f0`.
- **Emergency Dispatch / Critical SOS:** Background `#b91c1c`, text `#ffffff`, radius 8px. Applied exclusively to irreversible, life-critical requests. Free of pulsing animations; visual weight stems from stark contrast and sharp typography.

### Chips & Badges
- Status chips leverage a subtle dual-tone construct: a light tinted background matched with a high-contrast deep solid text.
  - Normal/Safe: Background `#e9f3ed`, border `1px solid #c7e2d3`, text `#15432c`.
  - Advisory: Background `#fef3c7`, border `1px solid #fde68a`, text `#92400e`.
  - Critical Danger: Background `#fee2e2`, border `1px solid #fecaca`, text `#991b1b`.
- Pill-shaped geometry (height 24px–28px, horizontal padding 10px–12px), paired with `label-md` font settings and a distinct 6px solid status dot.

### Input Fields & Controls
- **Inputs:** 48px standard touch height, background `#ffffff`, border `1px solid #cbd5e1`, text `#1e293b`. Focused states drop the default neutral border and apply a crisp 1.5px border in Deep Forest Green (`#15432c`) without glow effects.
- **Checkboxes & Radios:** 20px physical size with 4px inner rounding for checkboxes and full circular geometry for radios. Active state filled with `#15432c` containing a sharp white icon.

### Cards & Dispatch Panels
- Background `#ffffff`, corner radius 16px, framed with `1px solid #e4e4dc`.
- Padded with 24px internally. Card headers separate metadata tags (timestamp, jurisdiction) from the headline using clean flex rows with 12px vertical spacing before descriptive content.

### Emergency Broadcast Bar (Specialized Component)
- Top-anchored public safety alert ribbon. Uses an off-white background with a deep 4px left-border anchor in either `#b91c1c` (Hazard) or `#d97706` (Advisory). Features immediate offline-sync timestamps and explicit single-tap helpline routing buttons.