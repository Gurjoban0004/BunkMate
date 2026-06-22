# 🎨 Presence Reborn - Design System & UI Specifications

This document serves as the official design standard for **Presence Reborn**. Any coding agent or developer working on the mobile app or web platform must strictly follow these theme configurations, typography guidelines, and UI component standards.

---

## 1. Core Visual Principles
* **No Glassmorphism:** Avoid blurry backdrops, frosted gradients, and translucent card layers. All surfaces must be solid, high-contrast, and clean.
* **No Decorative Emojis:** Do not use emojis (🔥, ✅, ❌, ⚠️) in headings, titles, or status views. Use geometric dots, colored badges, custom SVGs, or text tags (`SAFE`, `EDGE`, `LOW`).
* **Micro-Borders:** Cards must be separated by fine lines (`borderWidth: 1`) matching the theme's border color token. Avoid large shadow spreads; depth should be created via crisp container boundaries and flat background offsets.
* **Bento Grid Layout:** Group dashboard stats and widgets in clean, modular blocks with a uniform corner radius.

---

## 2. Dynamic Theme Mappings
We support **5 distinct designs**, each containing fully optimized Light and Dark mode parameters. Always reference these exact hex codes:

### 1️⃣ Nordic Slate (Warm Minimalist Paper)
A sophisticated design utilizing warm off-whites, charcoal accents, and muted earthy tones.
* **Light Mode:**
  * Background: `#FDFDFD` | Card Background: `#FFFFFF` | Sidebar: `#FAF9F6` | Inputs: `#F4F3EF`
  * Borders: `#E6E4E0` | Sub-Borders: `#F5F4F0`
  * Text Primary: `#1C1917` (Deep Charcoal) | Text Secondary: `#57534E`
  * Primary Accent: `#1C1917` (Raw Coal) | Accent Light: `#F4F3EF`
* **Dark Mode:**
  * Background: `#0C0A09` | Card Background: `#1C1917` | Sidebar: `#12100E` | Inputs: `#292524`
  * Borders: `#2E2A28` | Sub-Borders: `#23201E`
  * Text Primary: `#F5F5F4` (Crisp White) | Text Secondary: `#A8A29E`
  * Primary Accent: `#FAFAFA` | Accent Light: `#292524`

### 2️⃣ Chalkpad Classic (Original App Reborn)
A premium refactoring of the original app's sky-blue theme with polished highlights.
* **Light Mode:**
  * Background: `#F0F7FF` | Card Background: `#FFFFFF` | Sidebar: `#FFFFFF` | Inputs: `#F1F5F9`
  * Borders: `#E2E8F0` | Sub-Borders: `#F8FAFC`
  * Text Primary: `#0F172A` | Text Secondary: `#64748B`
  * Primary Accent: `#5B9BF2` (Sky Blue) | Accent Light: `#E8F1FF`
* **Dark Mode:**
  * Background: `#0B1120` | Card Background: `#141D2E` | Sidebar: `#0B1120` | Inputs: `#1E293B`
  * Borders: `#2D3A4F` | Sub-Borders: `#192336`
  * Text Primary: `#E2E8F0` | Text Secondary: `#94A3B8`
  * Primary Accent: `#5B9BF2` | Accent Light: `#1E3A5F`

### 3️⃣ Midnight Synth (Cyberpunk OLED)
A dark-centric theme using pure blacks, deep charcoal panels, and glowing neon nodes. (Renders identical in light & dark).
* **OLED Mode:**
  * Background: `#000000` | Card Background: `#0A0A0C` | Sidebar: `#050507` | Inputs: `#14141A`
  * Borders: `#1E1E26` | Sub-Borders: `#111116`
  * Text Primary: `#FAFAFA` | Text Secondary: `#A1A1AA` | Text Muted: `#52525B`
  * Primary Accent: `#A78BFA` (Neon Violet) | Accent Light: `#231C35`

### 4️⃣ Forest Sage (Matcha & Clay)
An organic palette featuring soft tea greens, dark olive, and warm clays.
* **Light Mode:**
  * Background: `#F5F6F3` | Card Background: `#FFFFFF` | Sidebar: `#ECEFEA` | Inputs: `#E3E8DF`
  * Borders: `#D2D8CB` | Sub-Borders: `#ECEFEA`
  * Text Primary: `#2C3527` | Text Secondary: `#586450`
  * Primary Accent: `#40513B` (Moss Green) | Accent Light: `#ECEFEA`
* **Dark Mode:**
  * Background: `#141712` | Card Background: `#1E231B` | Sidebar: `#181C15` | Inputs: `#272E23`
  * Borders: `#333C2E` | Sub-Borders: `#242A20`
  * Text Primary: `#EDF3EB` | Text Secondary: `#90A086`
  * Primary Accent: `#EDF3EB` | Accent Light: `#272E23`

### 5️⃣ Catppuccin Latte (Soothing Pastels)
A warm, pastel macchiato look with lavender accents and soft boundaries.
* **Light Mode (Latte):**
  * Background: `#EFF1F5` | Card Background: `#FFFFFF` | Sidebar: `#E6E9EF` | Inputs: `#CCD0DA`
  * Borders: `#BCC0CC` | Sub-Borders: `#E6E9EF`
  * Text Primary: `#4C4F69` | Text Secondary: `#6C6F85`
  * Primary Accent: `#7287FD` (Lavender) | Accent Light: `#E8EBFC`
* **Dark Mode (Mocha):**
  * Background: `#1E1E2E` | Card Background: `#252538` | Sidebar: `#181825` | Inputs: `#313244`
  * Borders: `#3E4057` | Sub-Borders: `#2A2B3C`
  * Text Primary: `#CDD6F4` | Text Secondary: `#A6ADC8`
  * Primary Accent: `#CBA6F7` (Mauve) | Accent Light: `#362D4A`

---

## 3. The "Today's Schedule" Progress Pill Widget
This component visualizes the day's timeline in a single highly-polished, horizontal indicator block:

```
[ Math (25%) | DSA (25%) | Physics (25%) | OS (25%) ]
                  ^
         [Current Time Marker]
```

### Technical Specs:
* **Container Track:** A horizontal bar (`height: 28px`, `borderRadius: var(--border-radius-md)`).
* **Day Partitioning:** The bar is divided into proportional blocks dynamically mapping the day's class timings. (e.g. 4 classes = `width: 25%` each).
* **Subject Accents:** Each block has a top-accent border line (`borderTopWidth: 3px`) colored with the subject's identifier color (Sage, Cobalt, Terracotta, Gold).
* **State Coloring:**
  * Unmarked state: Background matches `var(--input-bg)` (very muted gray/graphite).
  * Present state: Background fills with `var(--success-light)`.
  * Absent state: Background fills with `var(--danger-light)`.
* **Current Time Marker:** An absolute positioned indicator line (`width: 2px`, `height: 100%`, `backgroundColor: var(--primary-accent)`) sliding across the track based on current system time, topped with a circular handle (`width: 8px`, `height: 8px`).

---

## 4. Typography Standards
To maintain a high-end designer layout, implement these text parameters:

* **Display/Stats (circular percentage, hero numbers):**
  * Font Family: `Outfit`
  * Sizing: `22px` - `26px`
  * Weight: `800` (Extra Bold)
  * Letter Spacing: `-0.5px` (Tight tracking for premium numbers)
  * Line Height: `1.1` (Tightly stacked)
* **Headers & Sections:**
  * Font Family: `Outfit`
  * Sizing: `16px` - `20px`
  * Weight: `800`
  * Letter Spacing: `-0.3px`
* **Body / Labels:**
  * Font Family: `Inter`
  * Sizing: `12px` - `14px`
  * Weight: `500` (Regular) or `700` (Bold Labels)
  * Line Height: `1.4`
* **Micro Captions & Badges:**
  * Font Family: `Inter`
  * Sizing: `9px` - `10px`
  * Weight: `700`
  * Letter Spacing: `0.2px` - `0.5px`
  * Text Transform: `uppercase` (Always capitalize badges like `SAFE`, `1 HR`, `ATTENDED`)

---

## 5. Subject Color Palette (Earthy Accents)
To prevent the "generic template pastel" aesthetic, mapping of subject dots must use these muted custom codes (not bright neon):
* **Sage:** `#609384` (Dot) | `#E2ECE9` (Light BG) | `#1F2A27` (Dark BG)
* **Cobalt:** `#4A72B4` (Dot) | `#EBF2FA` (Light BG) | `#1C2433` (Dark BG)
* **Terracotta:** `#C85B49` (Dot) | `#F7EBE8` (Light BG) | `#2C1D1B` (Dark BG)
* **Sandy Gold:** `#B89647` (Dot) | `#FAF4E5` (Light BG) | `#282319` (Dark BG)
* **Slate Blue:** `#5F738E` (Dot) | `#ECF0F3` (Light BG) | `#1F232B` (Dark BG)
