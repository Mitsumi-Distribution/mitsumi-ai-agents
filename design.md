# UI/UX Design System
### Conversational AI Support Platform
*Authored by: Senior UI/UX Architect — 20 Years of Craft*

---

## 1. Design Philosophy

> **"Calm intelligence. Every pixel earns its place."**

This system embodies **refined utilitarian luxury** — interfaces that feel like they were designed by someone who read every Nielsen Norman Group study, burned through every Figma plugin, and still chose restraint over decoration. No purple gradients. No floating blobs. No "AI-ness". Just precise, trustworthy, breathable UI that accelerates task completion and builds user confidence.

**Core Pillars:**
- **Clarity over cleverness** — Users scan, not read. Design for glance-ability.
- **Spatial hierarchy** — Whitespace is not empty space. It is structure.
- **Micro-feedback loops** — Every interaction should feel responsive, tactile, and alive.
- **Emotional tone** — Warm but professional. Helpful but not bubbly.

---

## 2. Color System

```css
/* === DESIGN TOKENS — tailwind.config.js extend.colors === */

colors: {
  /* Neutrals — the foundation */
  slate: {
    950: '#0B0F19',   /* Page background (dark mode) */
    900: '#111827',   /* Card background (dark mode) */
    800: '#1E2535',   /* Elevated surfaces */
    700: '#2D3748',   /* Borders, dividers */
    500: '#64748B',   /* Muted text, placeholders */
    300: '#CBD5E1',   /* Subtle text */
    100: '#F1F5F9',   /* Page background (light mode) */
    50:  '#F8FAFC',   /* Card background (light mode) */
  },

  /* Primary — Indigo, not purple. Never purple. */
  brand: {
    DEFAULT: '#4F6AF5',   /* Primary actions */
    light:   '#6B84FF',   /* Hover states */
    dark:    '#3B52D9',   /* Active/pressed */
    subtle:  '#EEF1FF',   /* Tinted backgrounds (light mode) */
    glow:    '#4F6AF520', /* Glow effect backgrounds */
  },

  /* Semantic */
  success: '#10B981',  /* #10B981 — Emerald */
  warning: '#F59E0B',  /* #F59E0B — Amber */
  danger:  '#EF4444',  /* #EF4444 — Rose */
  info:    '#3B82F6',  /* #3B82F6 — Blue */

  /* Accent — use sparingly, only for star moments */
  accent:  '#F97316',  /* Warm orange — CTAs, badges, highlights */
}
```

**Usage Rules:**
- `brand.DEFAULT` on interactive elements only. Never decorative.
- `accent` used maximum once per view — it must command attention.
- Neutral backgrounds: always `slate.50` (light) or `slate.950` (dark).
- Text hierarchy: `slate.900` → `slate.600` → `slate.400`. Three levels max.

---

## 3. Typography

```js
/* tailwind.config.js — fontFamily */
fontFamily: {
  display: ['"Sora"', 'sans-serif'],        /* Headings — geometric, modern */
  body:    ['"DM Sans"', 'sans-serif'],      /* Body — readable, warm */
  mono:    ['"JetBrains Mono"', 'monospace'],/* Code, IDs, timestamps */
}
```

**Import (in index.html or globals.css):**
```html
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Type Scale

| Token | Class | Size | Weight | Usage |
|---|---|---|---|---|
| Display | `text-4xl font-display font-bold` | 36px | 700 | Page heroes, empty states |
| H1 | `text-2xl font-display font-semibold` | 24px | 600 | Section titles |
| H2 | `text-xl font-display font-semibold` | 20px | 600 | Card headers |
| H3 | `text-base font-display font-semibold` | 16px | 600 | Sub-sections |
| Body | `text-sm font-body` | 14px | 400 | Default text |
| Small | `text-xs font-body text-slate-500` | 12px | 400 | Captions, metadata |
| Mono | `text-xs font-mono` | 12px | 400 | IDs, timestamps, code |

---

## 4. Spacing & Layout

### Grid System
```
Max content width: max-w-7xl (1280px)
Page padding:      px-6 md:px-10 lg:px-16
Section gap:       space-y-8 or gap-8
Card inner pad:    p-6 (default) / p-5 (compact) / p-8 (spacious)
```

### Spacing Rhythm
Always use multiples of 4px. Use Tailwind's default scale.
- **Tight:** `gap-2`, `space-y-2` — within a single component
- **Normal:** `gap-4`, `space-y-4` — between sibling elements
- **Loose:** `gap-6`, `space-y-6` — between card sections
- **Breathe:** `gap-8` or `gap-10` — between major UI sections

---

## 5. Component Library

---

### 5.1 Cards

Cards are the **primary container unit**. Every card communicates its own elevation level.

#### Base Card
```html
<div class="
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-700/60
  rounded-2xl
  shadow-sm hover:shadow-md
  transition-shadow duration-200
  p-6
">
  <!-- content -->
</div>
```

#### Elevated Card (modals, popovers)
```html
<div class="
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-800
  rounded-2xl
  shadow-xl shadow-slate-200/60 dark:shadow-slate-950/80
  p-6
">
```

#### Interactive / Clickable Card
```html
<div class="
  group
  bg-white dark:bg-slate-900
  border border-slate-200 dark:border-slate-700/60
  rounded-2xl
  shadow-sm
  hover:shadow-lg hover:border-brand/40
  hover:-translate-y-0.5
  transition-all duration-200 ease-out
  cursor-pointer p-6
">
```

#### Stat Card
```html
<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 flex flex-col gap-3">
  <div class="flex items-center justify-between">
    <span class="text-xs font-body font-medium text-slate-500 uppercase tracking-widest">Total Conversations</span>
    <div class="w-8 h-8 rounded-lg bg-brand-subtle dark:bg-brand-glow flex items-center justify-center">
      <!-- Icon: text-brand -->
    </div>
  </div>
  <p class="text-3xl font-display font-bold text-slate-900 dark:text-white">2,841</p>
  <p class="text-xs font-body text-emerald-500 flex items-center gap-1">
    ↑ 12.4% <span class="text-slate-400">vs last week</span>
  </p>
</div>
```

#### Conversation Card
```html
<div class="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 hover:border-brand/40 hover:shadow-md transition-all duration-200">
  <div class="flex items-start justify-between gap-4">
    <div class="flex-1 min-w-0">
      <p class="text-sm font-body font-medium text-slate-800 dark:text-slate-100 truncate">
        How do I reset my password?
      </p>
      <p class="mt-1 text-xs font-body text-slate-400 line-clamp-2">
        You can reset your password by visiting the login page and clicking "Forgot Password"...
      </p>
    </div>
    <span class="shrink-0 text-xs font-mono text-slate-400 mt-0.5">14:32</span>
  </div>
  <div class="mt-4 flex items-center gap-3">
    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
      ● Active
    </span>
    <span class="text-xs font-mono text-slate-400">#sess_9f2a</span>
    <div class="ml-auto flex items-center gap-1 text-amber-400">
      ★★★★☆
    </div>
  </div>
</div>
```

#### Booking Card
```html
<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
  <!-- Top accent bar -->
  <div class="h-1 bg-gradient-to-r from-brand to-accent"></div>
  <div class="p-6">
    <div class="flex items-start justify-between">
      <div>
        <h3 class="text-base font-display font-semibold text-slate-900 dark:text-white">Sarah Kimani</h3>
        <p class="text-sm text-slate-500 mt-0.5">sarah@example.com</p>
      </div>
      <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-400/20">
        Pending
      </span>
    </div>
    <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Issue</p>
        <p class="text-sm text-slate-700 dark:text-slate-300 mt-1">Account access problem</p>
      </div>
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider font-medium">Local Time</p>
        <p class="text-sm font-mono text-slate-700 dark:text-slate-300 mt-1">Mon 09:15 EAT</p>
      </div>
    </div>
  </div>
</div>
```

---

### 5.2 Forms

#### Form Layout Wrapper
```html
<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm p-8 max-w-lg mx-auto">
  <div class="mb-6">
    <h2 class="text-xl font-display font-semibold text-slate-900 dark:text-white">Book a Session</h2>
    <p class="text-sm text-slate-500 mt-1">Fill in your details and we'll confirm shortly.</p>
  </div>

  <form class="space-y-5">
    <!-- Fields here -->
  </form>
</div>
```

#### Text Input
```html
<div class="flex flex-col gap-1.5">
  <label class="text-xs font-body font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
    Full Name
  </label>
  <input
    type="text"
    placeholder="Sarah Kimani"
    class="
      w-full px-4 py-3
      bg-slate-50 dark:bg-slate-800/60
      border border-slate-200 dark:border-slate-700
      rounded-xl
      text-sm font-body text-slate-900 dark:text-white
      placeholder:text-slate-400
      outline-none
      focus:ring-2 focus:ring-brand/30 focus:border-brand
      transition-all duration-150
    "
  />
  <!-- Error state: border-danger focus:ring-danger/20 -->
  <!-- Helper text -->
  <p class="text-xs text-slate-400">As it appears on official documents.</p>
</div>
```

#### Textarea
```html
<div class="flex flex-col gap-1.5">
  <label class="text-xs font-body font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
    Describe your issue
  </label>
  <textarea
    rows="4"
    placeholder="Tell us what's happening..."
    class="
      w-full px-4 py-3
      bg-slate-50 dark:bg-slate-800/60
      border border-slate-200 dark:border-slate-700
      rounded-xl resize-none
      text-sm font-body text-slate-900 dark:text-white
      placeholder:text-slate-400
      outline-none
      focus:ring-2 focus:ring-brand/30 focus:border-brand
      transition-all duration-150
    "
  ></textarea>
</div>
```

#### Select / Dropdown
```html
<div class="flex flex-col gap-1.5">
  <label class="text-xs font-body font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
    Timezone
  </label>
  <div class="relative">
    <select class="
      w-full px-4 py-3 pr-10 appearance-none
      bg-slate-50 dark:bg-slate-800/60
      border border-slate-200 dark:border-slate-700
      rounded-xl
      text-sm font-body text-slate-900 dark:text-white
      outline-none
      focus:ring-2 focus:ring-brand/30 focus:border-brand
      transition-all duration-150 cursor-pointer
    ">
      <option>Africa/Nairobi (EAT)</option>
      <option>Europe/London (GMT)</option>
    </select>
    <!-- Chevron icon absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 -->
  </div>
</div>
```

#### Form Validation States
```html
<!-- Error -->
<input class="border-danger focus:ring-danger/20 bg-danger/5 ..." />
<p class="text-xs text-danger flex items-center gap-1 mt-1">⚠ This field is required.</p>

<!-- Success -->
<input class="border-success focus:ring-success/20 ..." />
<p class="text-xs text-success flex items-center gap-1 mt-1">✓ Looks good!</p>
```

---

### 5.3 Buttons

```html
<!-- Primary -->
<button class="
  inline-flex items-center justify-center gap-2
  px-5 py-2.5
  bg-brand hover:bg-brand-light active:bg-brand-dark
  text-white text-sm font-body font-semibold
  rounded-xl
  shadow-sm shadow-brand/20
  hover:shadow-md hover:shadow-brand/25
  hover:-translate-y-px active:translate-y-0
  transition-all duration-150
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
">
  Confirm Booking
</button>

<!-- Secondary / Ghost -->
<button class="
  inline-flex items-center justify-center gap-2
  px-5 py-2.5
  bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800
  text-slate-700 dark:text-slate-300 text-sm font-body font-semibold
  border border-slate-200 dark:border-slate-700
  rounded-xl
  transition-all duration-150
">
  Cancel
</button>

<!-- Danger -->
<button class="
  inline-flex items-center justify-center gap-2
  px-5 py-2.5
  bg-danger/10 hover:bg-danger/20
  text-danger text-sm font-body font-semibold
  border border-danger/20
  rounded-xl transition-all duration-150
">
  Delete Record
</button>

<!-- Icon Button -->
<button class="
  w-9 h-9
  flex items-center justify-center
  rounded-xl
  bg-slate-100 dark:bg-slate-800
  hover:bg-slate-200 dark:hover:bg-slate-700
  text-slate-500 dark:text-slate-400
  transition-colors duration-150
">
  <!-- SVG icon -->
</button>
```

---

### 5.4 Badges & Tags

```html
<!-- Status Badges -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
  bg-emerald-50 text-emerald-700 border border-emerald-200
  dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
  Active
</span>

<span class="... bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400">Pending</span>
<span class="... bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400">Closed</span>
<span class="... bg-danger/10 text-danger border-danger/20">Failed</span>

<!-- Count Badge -->
<span class="min-w-5 h-5 px-1.5 rounded-full bg-brand text-white text-xs font-mono font-semibold flex items-center justify-center">
  12
</span>
```

---

### 5.5 Rating Component

```html
<div class="flex flex-col gap-3 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
  <p class="text-sm font-body font-medium text-slate-700 dark:text-slate-300">How helpful was this response?</p>
  <div class="flex items-center gap-1.5">
    <!-- 5 stars — use JS to manage active state -->
    <button class="text-2xl text-amber-400 hover:scale-110 transition-transform duration-100 cursor-pointer">★</button>
    <button class="text-2xl text-amber-400 hover:scale-110 transition-transform duration-100 cursor-pointer">★</button>
    <button class="text-2xl text-amber-400 hover:scale-110 transition-transform duration-100 cursor-pointer">★</button>
    <button class="text-2xl text-slate-300 dark:text-slate-600 hover:text-amber-300 hover:scale-110 transition-all duration-100 cursor-pointer">★</button>
    <button class="text-2xl text-slate-300 dark:text-slate-600 hover:text-amber-300 hover:scale-110 transition-all duration-100 cursor-pointer">★</button>
    <span class="ml-2 text-sm font-body text-slate-500">3 / 5</span>
  </div>
</div>
```

---

### 5.6 Chat / Conversation UI

```html
<div class="flex flex-col h-full bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">

  <!-- Header -->
  <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold">A</div>
    <div>
      <p class="text-sm font-display font-semibold text-slate-800 dark:text-white">AI Assistant</p>
      <p class="text-xs text-emerald-500 flex items-center gap-1"><span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online</p>
    </div>
    <span class="ml-auto text-xs font-mono text-slate-400">#sess_9f2a</span>
  </div>

  <!-- Messages -->
  <div class="flex-1 overflow-y-auto px-5 py-6 space-y-4">

    <!-- User Message -->
    <div class="flex justify-end">
      <div class="max-w-[75%] bg-brand text-white text-sm font-body rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm shadow-brand/20">
        How do I reset my password?
      </div>
    </div>

    <!-- Bot Message -->
    <div class="flex items-end gap-2">
      <div class="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">AI</div>
      <div class="max-w-[75%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-body rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        You can reset your password by going to the login page and clicking <strong>"Forgot Password"</strong>. Enter your email and check your inbox.
        <div class="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <span class="font-mono">14:32</span>
          <span>·</span>
          <span>Score: 0.94</span>
        </div>
      </div>
    </div>

  </div>

  <!-- Input Bar -->
  <div class="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
    <div class="flex items-end gap-2">
      <textarea
        rows="1"
        placeholder="Type a message..."
        class="flex-1 resize-none px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-body text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand/30 transition-all"
      ></textarea>
      <button class="w-10 h-10 rounded-xl bg-brand hover:bg-brand-light text-white flex items-center justify-center shrink-0 transition-colors duration-150">
        ↑
      </button>
    </div>
  </div>

</div>
```

---

### 5.7 Data Table

```html
<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">

  <!-- Table Header -->
  <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
    <h2 class="text-base font-display font-semibold text-slate-900 dark:text-white">Conversations</h2>
    <div class="flex items-center gap-2">
      <input placeholder="Search..." class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand/30 w-44 transition-all"/>
      <button class="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Filter</button>
    </div>
  </div>

  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-100 dark:border-slate-800">
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Session</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Query</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Score</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Rating</th>
        <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Time</th>
        <th class="px-6 py-3"></th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
        <td class="px-6 py-4 font-mono text-xs text-slate-400">#sess_9f2a</td>
        <td class="px-6 py-4 text-slate-800 dark:text-slate-200 font-body max-w-xs truncate">How do I reset my password?</td>
        <td class="px-6 py-4">
          <span class="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">0.94</span>
        </td>
        <td class="px-6 py-4 text-amber-400 font-mono text-xs tracking-widest">★★★★☆</td>
        <td class="px-6 py-4 font-mono text-xs text-slate-400">14:32 today</td>
        <td class="px-6 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <button class="text-xs text-brand hover:underline font-medium">View →</button>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Pagination -->
  <div class="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
    <p class="text-xs text-slate-400 font-body">Showing <span class="text-slate-600 dark:text-slate-300 font-medium">1–20</span> of 2,841</p>
    <div class="flex items-center gap-1">
      <button class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-sm">‹</button>
      <button class="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center text-xs font-semibold">1</button>
      <button class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs">2</button>
      <button class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs">3</button>
      <button class="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-sm">›</button>
    </div>
  </div>

</div>
```

---

### 5.8 Toast Notifications

```html
<!-- Container: fixed bottom-6 right-6 z-50 flex flex-col gap-2 -->

<!-- Success Toast -->
<div class="flex items-start gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 min-w-72 max-w-sm animate-in slide-in-from-right-4 duration-300">
  <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 text-base">✓</div>
  <div class="flex-1 min-w-0">
    <p class="text-sm font-semibold text-slate-800 dark:text-white">Booking confirmed</p>
    <p class="text-xs text-slate-500 mt-0.5">Sarah's session has been saved.</p>
  </div>
  <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none">×</button>
</div>

<!-- Error Toast: border-danger/20, bg-danger/5, icon bg-danger/10 text-danger -->
```

---

### 5.9 Empty States

```html
<div class="flex flex-col items-center justify-center py-20 px-8 text-center">
  <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mb-5">
    💬
  </div>
  <h3 class="text-lg font-display font-semibold text-slate-800 dark:text-white">No conversations yet</h3>
  <p class="text-sm font-body text-slate-500 mt-2 max-w-xs">
    When users start chatting, their sessions will appear here.
  </p>
  <button class="mt-6 px-5 py-2.5 bg-brand hover:bg-brand-light text-white text-sm font-semibold rounded-xl transition-all duration-150 shadow-sm shadow-brand/20">
    Start a session
  </button>
</div>
```

---

### 5.10 Sidebar Navigation

```html
<aside class="w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">

  <!-- Logo -->
  <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-brand flex items-center justify-center">
        <span class="text-white text-sm font-bold font-display">A</span>
      </div>
      <span class="text-base font-display font-bold text-slate-900 dark:text-white">AssistIQ</span>
    </div>
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

    <!-- Active Item -->
    <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-subtle dark:bg-brand-glow text-brand font-medium text-sm font-body">
      <!-- Icon -->
      <span>Dashboard</span>
    </a>

    <!-- Inactive Item -->
    <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-sm font-body transition-colors">
      <!-- Icon -->
      <span>Conversations</span>
      <span class="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-brand text-white text-xs font-mono flex items-center justify-center">8</span>
    </a>

    <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-sm font-body transition-colors">
      <span>Bookings</span>
    </a>

    <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-sm font-body transition-colors">
      <span>Ratings</span>
    </a>

    <!-- Section Label -->
    <div class="pt-4 pb-1 px-3">
      <p class="text-xs font-semibold uppercase tracking-widest text-slate-400">Settings</p>
    </div>

    <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-body transition-colors">
      <span>Preferences</span>
    </a>
  </nav>

  <!-- User footer -->
  <div class="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
    <div class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-accent text-white text-xs font-bold flex items-center justify-center">SK</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">Sarah Kimani</p>
        <p class="text-xs text-slate-400 truncate">Admin</p>
      </div>
    </div>
  </div>
</aside>
```

---

## 6. Animation Guidelines

```css
/* In your globals.css */

/* Fade up — for cards entering view */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up {
  animation: fade-up 0.35s ease-out both;
}

/* Staggered card grid entrance */
.card:nth-child(1) { animation-delay: 0ms; }
.card:nth-child(2) { animation-delay: 60ms; }
.card:nth-child(3) { animation-delay: 120ms; }
.card:nth-child(4) { animation-delay: 180ms; }

/* Skeleton loading */
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
  border-radius: 8px;
}
```

**Rules:**
- Duration: `150ms` for micro (hover), `300–350ms` for entrances, `200ms` for exits.
- Easing: `ease-out` for entrances, `ease-in` for exits.
- Never animate color and transform simultaneously on the same element.
- Loading skeletons always match the exact shape of the real content.

---

## 7. Dark Mode

All components use `dark:` variants. Dark mode is toggled via `class="dark"` on `<html>`.

```js
// Simple toggle
document.documentElement.classList.toggle('dark')

// Persist
localStorage.setItem('theme', 'dark')
```

Dark mode palette reference:
| Role | Light | Dark |
|---|---|---|
| Page BG | `slate-100` | `slate-950` |
| Card BG | `white` | `slate-900` |
| Elevated | `slate-50` | `slate-800` |
| Border | `slate-200` | `slate-700/60` |
| Text Primary | `slate-900` | `white` |
| Text Muted | `slate-500` | `slate-400` |

---

## 8. Accessibility Checklist

- [ ] All interactive elements have `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`
- [ ] Color contrast: 4.5:1 minimum for body text, 3:1 for large text
- [ ] Form fields always paired with `<label>` — never placeholder-only
- [ ] Buttons with icon-only have `aria-label`
- [ ] Status indicators never rely on color alone (add text or icon)
- [ ] `prefers-reduced-motion`: wrap animations in `@media (prefers-reduced-motion: no-preference)`
- [ ] All images have `alt` text; decorative images use `alt=""`
- [ ] Toasts auto-dismiss after 5s, with a close button

---

## 9. Tailwind Config Summary

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#4F6AF5',
          light:   '#6B84FF',
          dark:    '#3B52D9',
          subtle:  '#EEF1FF',
          glow:    'rgba(79,106,245,0.12)',
        },
        accent:  '#F97316',
        danger:  '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.08)',
        'brand': '0 4px 14px rgba(79,106,245,0.25)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

---

## 10. Page Layout Template

```html
<div class="min-h-screen bg-slate-100 dark:bg-slate-950 flex font-body">

  <!-- Sidebar -->
  <aside><!-- see §5.10 --></aside>

  <!-- Main -->
  <main class="flex-1 overflow-y-auto">

    <!-- Top bar -->
    <header class="sticky top-0 z-10 px-8 py-4 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-display font-semibold text-slate-900 dark:text-white">Dashboard</h1>
        <p class="text-xs text-slate-400 font-mono mt-0.5">Mon, 20 Apr 2026 · EAT</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Dark mode toggle, notifications, avatar -->
      </div>
    </header>

    <!-- Content -->
    <div class="px-8 py-8 space-y-8 max-w-7xl">

      <!-- Stat cards grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <!-- §5.1 Stat Cards × 4 -->
      </div>

      <!-- Two-column layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2"><!-- Table --></div>
        <div><!-- Chat / Bookings --></div>
      </div>

    </div>
  </main>
</div>
```

---

*End of Design System — v1.0*
*Maintain this document alongside component changes. Design without documentation is decoration.*