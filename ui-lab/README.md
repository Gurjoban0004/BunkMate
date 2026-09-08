# Presence — UI Lab

Mock only. Nothing in `presence/` is touched by any file here.

| File | What it is |
|---|---|
| `today.html` | **Today screen, 1:1 replica** — paper-gradient hero + bento class cards |
| `index.html` | your "Pastel UI Lab" (lilac / meadow / sky) — **not mine, left untouched** |
| `round1.html` | first pass: Aurora / Broadsheet / Bento |

> `index.html` was overwritten at 09:26 on 8 Sep by the pastel mock. My round-2 file
> (Vault / Canvas / Runway) was in that slot and is gone. Say the word and I'll rebuild it.

## today.html

A one-to-one replica of `src/screens/main/TodayScreen.js`, component for component:

| Real component | In the mock |
|---|---|
| `header` (greeting, date, statusLine) | the hero + "updated through" line |
| `TodayScheduleBar` | track of four blocks + live time marker |
| `QuickAnswerCard` (compact) | the day verdict strip |
| `SectionHeader` | "Today", class count, Mark holiday |
| `ClassCard isCurrentClass` | full-width NOW card (2 HR / LOW tags, bar, verdict) |
| `ClassCard` × upcoming | bento tiles |
| `ClassCard` × done | bento tiles, dimmed + ticked |
| `settingsFooter` | avatar + Settings |

### The two references, applied

**The hero** keeps the reference layout — date, serif greeting, quote, avatar, mantra column —
but the photograph is replaced by a generated surface. Three switchable treatments:

- **Paper** — warm stock, a shaft of light, a blurred window shadow, SVG-turbulence grain
- **Dawn** — a soft four-stop mesh, no hard light source
- **Linen** — a woven weave plus a vignette

**The bento tiles** keep your pastel anatomy exactly (time, long gap, bold name, room) and are used
**only for classes that are not happening** — done, or later. The live class keeps a full-width
surface. The tiles carry one line the originals were missing: the verdict.

### Palettes (the experiment)

Forest Sage and Nordic aren't touched in the app. These are three ways out of the blandness:

- **Meadow** — Presence's sage / clay / gold / cobalt, warmer and more saturated than Forest Sage
- **Bloom** — your pastel identity kept (mint, lilac, peach, rose), accent pulled to a Presence plum
- **Dusk** — the experiment: pine, indigo, rust, ochre. Deeper and moodier, still warm.

Tile washes are `color-mix(hue, surface)`, so every palette works in light and dark from one hex.

**Deviation:** 24-hour times, as in your reference tiles. The app formats 12-hour.
