# Design system

Status: all student screens and the exam are migrated; auth and admin login share the dark `au-*` shell.
Pending: admin workspace.

## Tokens (`src/styles/tokens.css`)
- Semantic colours `--c-*` (indigo primary, slate neutrals, emerald/amber/rose/sky status). Light by default; `[data-theme="dark"]` overrides.
- Spacing `--sp-1..12` (4px scale), radii `--r-*`, shadows `--sh-*`, z-index `--z-*`, motion `--dur-*` and `--ease`.
- Legacy variable names (`--primary`, `--bg-main`, ...) are aliased to the new tokens so unmigrated screens inherit the palette.

## Theme
`useTheme()` (`src/utils/theme.ts`) reads/writes localStorage key `ui-theme`, defaulting to the OS preference.
Dark is applied by putting `data-theme` on a migrated screen's root, so unmigrated screens are never half-dark.

## Components (`src/styles/ui.css`)
`ui-btn` (+ `--primary|secondary|ghost|sm|icon`), `ui-card`, `ui-chip`, `ui-badge`, `ui-skeleton`, `ui-stepper`, `ui-ring`. Icons: `lucide-react`, 18px, stroke 1.75.

## Motion
120/200/280/400ms with `cubic-bezier(.2,.8,.2,1)`; only `transform` and `opacity`. Page enter `ui-page`, lists `ui-stagger` (40ms step). `prefers-reduced-motion` collapses durations.

## Exam screen (`ExamEngine.tsx`, `components/exam/ExamParts.tsx`, `styles/exam.css`)
- UI-only state: palette filter, drawer, mark-for-review (sessionStorage `ui-review-marks-<examId>`), save status (from the existing `updateResultDraft` boolean), timer notices at 10/5/1 min.
- Palette is docked >=1100px for non-code questions, a drawer otherwise, a bottom sheet <=640px.
- Shortcuts (1-4/A-D, arrows, M) are bubble-phase listeners that skip `defaultPrevented` events and any Alt/Ctrl/Meta/Shift combo, so the proctoring capture handlers always run first.
- Code workspace is always dark; editor is a plain textarea with a synced line-number gutter.
