# Warm Paper & Editorial Pastel Design System
> A tactile, high-density, editorial aesthetic inspired by Kinfolk and Notion. Built for dashboards, data tools, telemetry consoles, and intelligent applications that reject generic AI slop and dark neon gradients.

---

## 1. Design Philosophy

Modern software often defaults to one of two extremes: blinding sterile white corporate SaaS (`#ffffff` everywhere with harsh `#000000` text) or aggressive neon "cyberpunk" dark mode with emoji overload.

This design system takes the opposite path:
1. **Warm Paper Foundation**: The background is not white or grey; it is an organic, unbleached paper tone (`#f8f6f2`). It reduces eye fatigue, feels tactile, and creates natural contrast with pure white cards.
2. **Tactile Boundaries**: Depth is achieved through precise 1px borders (`#e7e2d9`) and subtle micro-shadows rather than heavy, blurry drop-shadows.
3. **Deep Ink Typography**: High-contrast, warm dark-ink (`#23201d`) instead of pure black `#000000`, paired with warm stone secondary tones.
4. **Quiet Pastels**: Color is used strictly for semantic hierarchy, telemetry, and category identity (Coral, Sage, Lavender, Sand).
5. **Anti-Slop / Zero Emojis**: Replaces cartoonish emojis with refined micro-labels, uppercase tracking, and clean mono badges.
6. **Dual Typography Pairing**: An elegant, human geometric sans (`Plus Jakarta Sans`) for reading, paired with a precision monospace (`JetBrains Mono`) for all metrics, numbers, code, and timestamps.

---

## 2. Color Palette & Design Tokens

### The Core Canvas & Ink
| Token | Hex | Tailwind Class / CSS Var | Purpose |
| :--- | :--- | :--- | :--- |
| **Paper Canvas** | `#f8f6f2` | `bg-[#f8f6f2]` / `--bg-paper` | Base page background |
| **Card Surface** | `#ffffff` | `bg-[#ffffff]` / `--bg-surface` | Primary content cards |
| **Surface Elevated**| `#fcfbfa` | `bg-[#fcfbfa]` / `--bg-surface-elevated` | Secondary nested cards / lists |
| **Subtle Fill** | `#f1ede6` | `bg-[#f1ede6]` / `--bg-subtle` | Input backgrounds, active states, tab tracks |
| **Paper Border** | `#e7e2d9` | `border-[#e7e2d9]` / `--border-paper` | Default 1px card and divider borders |
| **Border Strong** | `#d4cec3` | `border-[#d4cec3]` / `--border-paper-strong` | Hover borders, focus borders |
| **Deep Ink** | `#23201d` | `text-[#23201d]` / `--text-ink` | Headings, primary text, dark buttons |
| **Stone Secondary**| `#5c5852` | `text-[#5c5852]` / `--text-secondary` | Body text, table data |
| **Muted Slate** | `#888279` | `text-[#888279]` / `--text-muted` | Micro-labels, axis ticks, timestamps |

### The Editorial Pastel Accents
Each accent comes with a primary color, a soft tinted background, and a border stroke:

| Accent | Primary Hex | Tint Background | Border Color | Typical Semantic Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Coral** | `#e27d60` | `#fdf3f0` | `rgba(226, 125, 96, 0.25)` | Primary alerts, user 1 metrics, highlights, active selections |
| **Sage** | `#6b8e7f` | `#f0f5f2` | `rgba(107, 142, 127, 0.25)` | Success states, cache hits, health indicators, stability |
| **Lavender**| `#7f7aa8` | `#f3f2f8` | `rgba(127, 122, 168, 0.25)` | User 2 metrics, secondary series, media shares |
| **Sand** | `#c99355` | `#fcf7f0` | `rgba(201, 147, 85, 0.25)` | Timelines, tertiary series, warnings, streaks |

---

## 3. Tailwind Configuration Snippet

Add this directly to your `tailwind.config` in `tailwind.config.js` or in the CDN script block:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fdfcfb',
          100: '#f8f6f2',
          200: '#f1ede6',
          300: '#e7e2d9',
          400: '#d4cec3',
          500: '#888279',
          700: '#5c5852',
          900: '#23201d'
        },
        pastel: {
          coral: '#e27d60',
          'coral-bg': '#fdf3f0',
          sage: '#6b8e7f',
          'sage-bg': '#f0f5f2',
          lavender: '#7f7aa8',
          'lavender-bg': '#f3f2f8',
          sand: '#c99355',
          'sand-bg': '#fcf7f0'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      boxShadow: {
        'paper-xs': '0 1px 2px rgba(35, 32, 29, 0.04)',
        'paper-sm': '0 1px 3px rgba(35, 32, 29, 0.03), 0 4px 12px rgba(35, 32, 29, 0.02)',
        'paper-md': '0 2px 6px rgba(35, 32, 29, 0.04), 0 8px 18px rgba(35, 32, 29, 0.03)'
      }
    }
  }
}
```

---

## 4. Typography & Hierarchy

### Google Fonts Import
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Hierarchy Rules
- **Micro-Labels**: Uppercase, tracked, 10–11px, bold, muted stone:
  `text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]`
- **Headings**: Tight tracking (`tracking-tight`), deep ink `#23201d`, semibold or bold:
  `text-xl font-bold tracking-tight text-[#23201d]`
- **Telemetry Numbers**: Always `font-mono`, bold, prominent size:
  `text-2xl font-bold font-mono text-[#23201d]`
- **Body & Explanatory Text**: 12–14px, line-height 1.6, stone `#5c5852`:
  `text-xs text-[#5c5852] leading-relaxed`
- **Timestamps & Technical Identifiers**: 10–11px `font-mono text-[#888279]`.

---

## 5. Ready-to-Use UI Component Snippets

### A. Primary Paper Card
```html
<div class="bg-[#ffffff] border border-[#e7e2d9] hover:border-[#d4cec3] rounded-[14px] p-5 shadow-[0_1px_3px_rgba(35,32,29,0.03),0_4px_12px_rgba(35,32,29,0.02)] transition">
  <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279] block mb-1">
    Telemetry Metric
  </span>
  <h3 class="text-sm font-bold text-[#23201d]">Card Title Here</h3>
  <p class="text-xs text-[#5c5852] mt-1 leading-relaxed">
    Descriptive copy with restrained typography and clean borders.
  </p>
</div>
```

### B. Metric Summary Card (4-Grid Stat Block)
```html
<div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-4">
  <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279] block">
    Turnaround Latency
  </span>
  <div class="mt-2 text-2xl font-bold font-mono text-[#23201d]">
    13s
  </div>
  <div class="text-[11px] text-[#78716c] font-mono mt-0.5">
    Peer comparison: <span class="text-[#c45b3c] font-semibold">10s</span>
  </div>
</div>
```

### C. Pastel Badges (Status Pills)
```html
<!-- Coral (Alert / Primary) -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#fdf3f0] border border-[rgba(226,125,96,0.25)] text-[#c45b3c] font-mono text-[11px] font-semibold">
  48.1% Share
</span>

<!-- Sage (Success / Online / Active) -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#f0f5f2] border border-[rgba(107,142,127,0.25)] text-[#4c6b5d] font-mono text-[11px] font-semibold">
  Cache Active
</span>

<!-- Lavender (Secondary Dimension) -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#f3f2f8] border border-[rgba(127,122,168,0.25)] text-[#5c5852] font-mono text-[11px] font-semibold">
  6,777 Reels
</span>

<!-- Sand (Neutral / Timespan) -->
<span class="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#fcf7f0] border border-[rgba(201,147,85,0.25)] text-[#9c6c32] font-mono text-[11px] font-semibold">
  119 Consecutive Days
</span>
```

### D. Deep Ink Action Buttons
```html
<!-- Primary Deep Ink Button -->
<button class="px-4 py-2 rounded-xl bg-[#23201d] hover:bg-[#3d3833] text-white font-medium text-xs font-mono transition shadow-xs">
  Confirm Action
</button>

<!-- Secondary Subtle Button -->
<button class="px-4 py-2 rounded-xl bg-[#ffffff] hover:bg-[#fcfbfa] border border-[#e7e2d9] hover:border-[#d4cec3] text-[#23201d] font-medium text-xs font-mono transition shadow-2xs">
  Change Settings
</button>
```

### E. Segmented Balance Bar (Two-Way Distribution)
```html
<div class="space-y-2">
  <div class="flex justify-between text-xs font-mono font-semibold">
    <span class="text-[#c45b3c]">User 1 (48%)</span>
    <span class="text-[#5c5852]">User 2 (52%)</span>
  </div>
  <div class="w-full h-2.5 rounded-full bg-[#f1ede6] overflow-hidden flex shadow-inner">
    <div class="h-full bg-[#e27d60] transition-all duration-500" style="width: 48%"></div>
    <div class="h-full bg-[#7f7aa8] transition-all duration-500" style="width: 52%"></div>
  </div>
</div>
```

### F. Friends Drawer / List Item with Pastel Avatar
```html
<div class="p-2.5 rounded-xl border border-[#e7e2d9] bg-[#fcfbfa] hover:bg-[#ffffff] hover:border-[#d4cec3] transition cursor-pointer flex items-center justify-between group">
  <div class="flex items-center space-x-2.5 truncate">
    <!-- Pastel Avatar -->
    <div class="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 font-mono bg-[#fdf3f0] text-[#c45b3c] border border-[rgba(226,125,96,0.3)]">
      H
    </div>
    <div class="truncate">
      <div class="font-bold text-xs text-[#23201d] truncate group-hover:text-[#c45b3c] transition">
        Harman Aujla
      </div>
      <div class="text-[10px] text-[#888279] font-mono truncate">
        54,093 messages
      </div>
    </div>
  </div>
  <span class="text-[10px] font-mono text-[#888279] px-1.5 py-0.5 rounded bg-[#f1ede6] shrink-0 ml-2">
    Active
  </span>
</div>
```

---

## 6. Chart.js Styling Guide (Editorial Pastels)

To ensure Chart.js matches this aesthetic seamlessly:
- Eliminate default grey backgrounds and stark black borders.
- Set gridlines to very subtle ink opacity (`rgba(35, 32, 29, 0.06)`).
- Turn off X-axis gridlines completely for a clean look.
- Use `JetBrains Mono` at 8–9px for axis labels.
- Set line chart fills to 8% opacity (`rgba(..., 0.08)`).
- Set bar chart corners to `borderRadius: 3`.

### Full Chart.js Palette
```javascript
const CHART_PALETTE = {
  coral: {
    line: '#e27d60',
    fill: 'rgba(226, 125, 96, 0.08)',
    bar: '#e27d60'
  },
  lavender: {
    line: '#7f7aa8',
    fill: 'rgba(127, 122, 168, 0.08)',
    bar: '#7f7aa8'
  },
  sand: {
    line: '#c99355',
    fill: 'rgba(201, 147, 85, 0.08)',
    bar: '#c99355'
  },
  sage: {
    line: '#6b8e7f',
    fill: 'rgba(107, 142, 127, 0.08)',
    bar: '#6b8e7f'
  }
};
```

### Complete Line Chart Configuration Snippet
```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Metric A',
        data: [120, 190, 300, 500, 420, 610],
        borderColor: CHART_PALETTE.coral.line,
        backgroundColor: CHART_PALETTE.coral.fill,
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: CHART_PALETTE.coral.line,
        tension: 0.25,
        fill: true
      },
      {
        label: 'Metric B',
        data: [80, 140, 220, 310, 490, 520],
        borderColor: CHART_PALETTE.lavender.line,
        backgroundColor: CHART_PALETTE.lavender.fill,
        borderWidth: 2,
        pointRadius: 2,
        pointBackgroundColor: CHART_PALETTE.lavender.line,
        tension: 0.25,
        fill: true
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#5c5852',
          boxWidth: 10,
          font: { family: 'JetBrains Mono', size: 10, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: '#23201d',
        titleFont: { family: 'JetBrains Mono', size: 11, weight: 'bold' },
        bodyFont: { family: 'JetBrains Mono', size: 10 },
        padding: 8,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 9 } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 9 } },
        grid: { color: 'rgba(35, 32, 29, 0.06)' }
      }
    }
  }
});
```

### Complete Bar Chart Configuration Snippet
```javascript
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      {
        label: 'Sent',
        data: [12, 5, 45, 120, 80, 150],
        backgroundColor: CHART_PALETTE.coral.bar,
        borderRadius: 3
      },
      {
        label: 'Received',
        data: [8, 3, 30, 95, 110, 130],
        backgroundColor: CHART_PALETTE.sand.bar,
        borderRadius: 3
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#5c5852',
          boxWidth: 10,
          font: { family: 'JetBrains Mono', size: 10, weight: '600' }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 8 } },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 9 } },
        grid: { color: 'rgba(35, 32, 29, 0.06)' }
      }
    }
  }
});
```

---

## 7. Minimal Complete Boilerplate (`index.html`)

Copy and paste this into any new project to instantly have a working, pre-styled template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Warm Paper & Pastel Dashboard</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: #f8f6f2;
      color: #23201d;
      -webkit-font-smoothing: antialiased;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    /* Subtle custom scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #f8f6f2; }
    ::-webkit-scrollbar-thumb { background: #d8d3c8; border-radius: 3px; }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between selection:bg-[#fdf3f0] selection:text-[#c45b3c]">

  <!-- Top Navigation -->
  <header class="border-b border-[#e7e2d9] bg-[#f8f6f2]/90 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-7 h-7 rounded-lg bg-[#ffffff] border border-[#e7e2d9] flex items-center justify-center font-mono text-xs font-bold text-[#23201d]">
          P
        </div>
        <span class="font-bold text-sm text-[#23201d] tracking-tight">Project Name</span>
        <span class="text-[#888279] font-mono text-xs">/ Console</span>
      </div>
      <div class="flex items-center space-x-2">
        <span class="px-2.5 py-1 rounded-md bg-[#f0f5f2] border border-[rgba(107,142,127,0.25)] text-[#4c6b5d] font-mono text-xs font-semibold">
          Status: Operational
        </span>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-6 py-8 w-full flex-grow space-y-6">
    
    <!-- 4-Metric Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-4 shadow-xs">
        <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]">Metric 1</span>
        <div class="text-2xl font-bold font-mono text-[#23201d] mt-2">54,093</div>
        <div class="text-[11px] font-mono text-[#c45b3c] mt-0.5">+12% increase</div>
      </div>
      <div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-4 shadow-xs">
        <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]">Metric 2</span>
        <div class="text-2xl font-bold font-mono text-[#23201d] mt-2">13s</div>
        <div class="text-[11px] font-mono text-[#888279] mt-0.5">Median latency</div>
      </div>
      <div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-4 shadow-xs">
        <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]">Metric 3</span>
        <div class="text-2xl font-bold font-mono text-[#23201d] mt-2">119 Days</div>
        <div class="text-[11px] font-mono text-[#4c6b5d] mt-0.5">Active streak</div>
      </div>
      <div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-4 shadow-xs">
        <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]">Metric 4</span>
        <div class="text-2xl font-bold font-mono text-[#23201d] mt-2">8,868</div>
        <div class="text-[11px] font-mono text-[#7f7aa8] mt-0.5">Shared objects</div>
      </div>
    </div>

    <!-- Chart Panel -->
    <div class="bg-[#ffffff] border border-[#e7e2d9] rounded-[14px] p-6 shadow-xs">
      <div class="flex justify-between items-center mb-4">
        <div>
          <span class="text-[10px] font-mono uppercase tracking-wider font-bold text-[#888279]">Telemetry</span>
          <h3 class="text-sm font-bold text-[#23201d]">Timeline Distribution</h3>
        </div>
        <button class="px-3.5 py-1.5 rounded-lg bg-[#23201d] text-white text-xs font-mono font-medium hover:bg-[#3d3833] transition">
          Export
        </button>
      </div>
      <div class="relative h-64">
        <canvas id="demoChart"></canvas>
      </div>
    </div>

  </main>

  <!-- Footer -->
  <footer class="border-t border-[#e7e2d9] py-5 text-center text-xs text-[#888279] font-mono">
    Editorial Dashboard &bull; Warm Paper & Pastel Architecture
  </footer>

  <script>
    const ctx = document.getElementById('demoChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
          label: 'Primary',
          data: [20, 35, 60, 85, 75, 110],
          borderColor: '#e27d60',
          backgroundColor: 'rgba(226, 125, 96, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#e27d60',
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#5c5852', boxWidth: 10, font: { family: 'JetBrains Mono', size: 10, weight: '600' } } }
        },
        scales: {
          x: { ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#888279', font: { family: 'JetBrains Mono', size: 9 } }, grid: { color: 'rgba(35, 32, 29, 0.06)' } }
        }
      }
    });
  </script>
</body>
</html>
```

---

## 8. Summary Checklist for New Projects

When applying this theme to any new project, verify:
- [x] Background is warm unbleached paper `#f8f6f2` (never harsh grey `#f3f4f6` or pure white `#ffffff`).
- [x] Cards are pure white `#ffffff` with thin 1px `#e7e2d9` borders and subtle radius (`14px`).
- [x] Text uses deep ink `#23201d` for primary and stone `#5c5852` for secondary (never `#000000`).
- [x] Numbers, telemetry, and code use `JetBrains Mono`.
- [x] Headings and UI copy use `Plus Jakarta Sans`.
- [x] Accents are restricted to the 4 soft pastels: Coral (`#e27d60`), Sage (`#6b8e7f`), Lavender (`#7f7aa8`), Sand (`#c99355`).
- [x] Zero cartoon emojis in buttons, badges, or headers. Micro-labels are uppercase and tracked.
- [x] Chart.js axes have muted `#888279` mono ticks, subtle `rgba(35, 32, 29, 0.06)` horizontal gridlines, and no vertical gridlines.
