# NextSchool Style Guide

A comprehensive reference for all design tokens, component patterns, and visual conventions used across the NextSchool codebase.

---

## Table of Contents

- [Brand Identity](#brand-identity)
- [Color System](#color-system)
- [Typography](#typography)
- [Spacing & Layout](#spacing--layout)
- [Components](#components)
- [Icons](#icons)
- [Animations & Transitions](#animations--transitions)
- [Shadows & Depth](#shadows--depth)
- [Border Radius](#border-radius)
- [Responsive Design](#responsive-design)
- [Accessibility](#accessibility)
- [Dark Mode](#dark-mode)
- [Consultant Theming](#consultant-theming)
- [File Reference](#file-reference)

---

## Brand Identity

| Attribute | Value |
|-----------|-------|
| **Logo** | `/public/logo.png` — used at `h-10` (navbar) and `h-8` (compact) |
| **Primary brand color** | Teal (`#134E4A` → `#F0FDFA`, 6-stop scale) |
| **Accent background** | Warm cream (`#F5F2ED`) |
| **Display font** | Playfair Display (serif, weight 500) |
| **Body font** | system-ui, -apple-system, sans-serif |
| **UI framework** | shadcn/ui — New York style, neutral base, HSL CSS variables |
| **Icon library** | Lucide React |
| **Dark mode** | Class-based (`.dark` on `<html>`) |

---

## Color System

### NextSchool Custom Tokens (`--ns-*`)

Defined in `src/app/globals.css`. Use these for brand-consistent styling.

#### Teal Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--ns-teal-900` | `#134E4A` | Primary buttons, strong headings |
| `--ns-teal-700` | `#0F766E` | Button hover states |
| `--ns-teal-600` | `#0D9488` | Accent text, labels, outlines, focus rings |
| `--ns-teal-500` | `#14B8A6` | Secondary buttons |
| `--ns-teal-100` | `#CCFBF1` | Light teal backgrounds |
| `--ns-teal-50`  | `#F0FDFA` | Outline button hover fill |

#### Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--ns-cream`      | `#F5F2ED` | Page backgrounds (warm) |
| `--ns-cream-dark`  | `#EDE8E0` | Darker cream variant |
| `--ns-text-primary` | `#1A1A1A` | Headings, primary text |
| `--ns-text-body`    | `#4A4A4A` | Body copy |
| `--ns-text-secondary`| `#6B7280` | Secondary/muted text |
| `--ns-border`       | `#E5E7EB` | Borders, dividers |

#### Shadows

| Token | Value |
|-------|-------|
| `--ns-card-shadow` | `0 2px 8px rgba(0, 0, 0, 0.06)` |

### shadcn/ui Theme Variables (HSL)

These power all shadcn components. Defined in `:root` and `.dark` in `globals.css`.

#### Light Mode (`:root`)

| Variable | HSL | Approximate Color |
|----------|-----|--------------------|
| `--background` | `40 33% 94.5%` | Warm beige |
| `--foreground` | `222.2 84% 4.9%` | Dark navy |
| `--card` | `0 0% 100%` | White |
| `--card-foreground` | `222.2 84% 4.9%` | Dark navy |
| `--popover` | `0 0% 100%` | White |
| `--popover-foreground` | `222.2 84% 4.9%` | Dark navy |
| `--primary` | `222.2 47.4% 11.2%` | Dark slate blue |
| `--primary-foreground` | `210 40% 98%` | Off-white |
| `--secondary` | `210 40% 96.1%` | Light blue-gray |
| `--secondary-foreground` | `222.2 47.4% 11.2%` | Dark slate |
| `--muted` | `210 40% 96.1%` | Light gray |
| `--muted-foreground` | `215.4 16.3% 46.9%` | Medium gray |
| `--accent` | `210 40% 96.1%` | Light blue-gray |
| `--accent-foreground` | `222.2 47.4% 11.2%` | Dark slate |
| `--destructive` | `0 84.2% 60.2%` | Red |
| `--destructive-foreground` | `210 40% 98%` | Off-white |
| `--border` | `214.3 31.8% 91.4%` | Light gray |
| `--input` | `214.3 31.8% 91.4%` | Light gray |
| `--ring` | `222.2 84% 4.9%` | Dark navy (focus) |
| `--radius` | `0.5rem` | 8px base |

#### Chart Colors

| Variable | Light (HSL) | Dark (HSL) |
|----------|-------------|------------|
| `--chart-1` | `12 76% 61%` (orange) | `220 70% 50%` (blue) |
| `--chart-2` | `173 58% 39%` (teal) | `160 60% 45%` (teal) |
| `--chart-3` | `197 37% 24%` (dark blue) | `30 80% 55%` (orange) |
| `--chart-4` | `43 74% 66%` (yellow) | `280 65% 60%` (purple) |
| `--chart-5` | `27 87% 67%` (orange-red) | `340 75% 55%` (pink) |

### Semantic Color Usage (Tailwind classes)

| Purpose | Classes |
|---------|---------|
| Primary actions | `bg-teal-600`, `hover:bg-teal-700`, `text-teal-600` |
| Primary text | `text-slate-900` |
| Secondary text | `text-slate-600`, `text-slate-700` |
| Muted text | `text-slate-500`, `text-slate-400` |
| Interactive hover | `hover:text-teal-600` |
| Success / match | `text-green-600` |
| Error / mismatch | `text-red-600`, `text-red-500` |
| Warning / highlight | `bg-amber-500/90`, `bg-amber-50/60`, `border-amber-200` |
| Unknown / neutral | `text-slate-400` |

---

## Typography

### Font Stack

| Role | Font | Weight | Source |
|------|------|--------|--------|
| Display & headings | Playfair Display, serif | 500 | Google Fonts (imported in `globals.css`) |
| Body & UI | system-ui, -apple-system, sans-serif | 400–600 | System |

All `h1`, `h2`, `h3` elements automatically use Playfair Display via a global rule.

### Custom Typography Classes

Use these `ns-*` classes for brand-consistent headings and labels.

| Class | Font | Size | Weight | Line-height | Color |
|-------|------|------|--------|-------------|-------|
| `.ns-display` | Playfair Display | 44px | 500 | 1.1 | `--ns-text-primary` |
| `.ns-heading` | Playfair Display | 28px | 500 | 1.2 | `--ns-text-primary` |
| `.ns-subheading` | Playfair Display | 20px | 500 | 1.3 | `--ns-text-primary` |
| `.ns-label` | system-ui | 12px | 600 | — | `--ns-teal-600` |

`.ns-label` also applies `text-transform: uppercase` and `letter-spacing: 1.2px`.

### Text Hierarchy (Tailwind)

| Level | Classes | Use case |
|-------|---------|----------|
| Hero title | `text-5xl sm:text-6xl font-bold` | Landing hero |
| Section header | `text-4xl font-bold` | Page sections |
| Card title | `text-3xl font-bold` | Featured content |
| Subsection | `text-2xl font-bold` | Panel headers |
| Panel header | `text-lg font-bold` | Side panels |
| Small header | `text-sm font-semibold` | Card sections |
| Label / meta | `text-xs font-medium` | Badges, timestamps |

### Text Truncation

- `line-clamp-1` — single line
- `line-clamp-2` — card titles
- `line-clamp-3` — descriptions

---

## Spacing & Layout

### Container

```jsx
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
```

### Padding Scale

| Context | Padding |
|---------|---------|
| Compact cards | `p-3` |
| Standard sections | `p-4`, `p-6` |
| Page sections | `p-8`, `py-20 sm:py-28` |
| Navbar | `py-4` |

### Gap Scale

| Size | Use case |
|------|----------|
| `gap-1`, `gap-1.5` | Badges, inline elements |
| `gap-2`, `gap-3` | Card internals, button groups |
| `gap-4`, `gap-6` | Section content |
| `gap-8` | Major sections, pricing grids |

### Grid Patterns

**Auto-fill card grid:**
```jsx
style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
className="grid gap-3"
```

**Two-column pricing:**
```jsx
className="md:grid-cols-2 gap-8"
```

### Sidebar Dimensions

| Variable | Value |
|----------|-------|
| `--sidebar-width` | `16rem` (256px) |
| `--sidebar-width-mobile` | `18rem` (288px) |
| `--sidebar-width-icon` | `3rem` (48px) |

---

## Components

### Buttons

#### Custom NextSchool Buttons (pill-shaped, brand-colored)

| Class | Background | Text | Hover | Border-radius |
|-------|-----------|------|-------|---------------|
| `.ns-btn-primary` | `--ns-teal-900` | white | `--ns-teal-700` | `9999px` |
| `.ns-btn-secondary` | `--ns-teal-500` | white | `--ns-teal-600` | `9999px` |
| `.ns-btn-outline` | transparent | `--ns-teal-600` | `bg --ns-teal-50` | `9999px` |

All three share: `font-weight: 600`, `padding: 0.75rem 1.75rem`, `min-width: 120px`, `transition: all 150ms ease`, `display: inline-flex` centered.

#### shadcn Button Variants (`src/components/ui/button.jsx`)

| Variant | Style |
|---------|-------|
| `default` | `bg-primary text-primary-foreground shadow` |
| `destructive` | Red background |
| `outline` | Border + light hover |
| `secondary` | Light gray background |
| `ghost` | Transparent, hover accent |
| `link` | Underlined text |

| Size | Dimensions |
|------|-----------|
| `sm` | `h-8 px-3 text-xs` |
| `default` | `h-9 px-4` |
| `lg` | `h-10 px-8` |
| `icon` | `h-9 w-9` |

### Cards

#### Custom NextSchool Cards

**`.ns-card`** — Static card:
```css
background: white;
border-radius: 8px;
border: 1px solid var(--ns-border);
box-shadow: var(--ns-card-shadow);
overflow: hidden;
```

**`.ns-card-interactive`** — Hoverable card (extends `.ns-card`):
```css
transition: all 200ms ease-out;
cursor: pointer;
/* Hover: */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
transform: translateY(-1px);
```

#### shadcn Card

```jsx
<Card>           {/* rounded-xl border bg-card shadow */}
  <CardHeader>   {/* p-6 */}
  <CardContent>  {/* p-6 pt-0 */}
  <CardFooter>   {/* p-6 pt-0 */}
</Card>
```

#### School Card Pattern

- Fixed height: `min-h-[450px]`
- Image area: `h-36` with gradient placeholder `bg-gradient-to-br from-slate-300 to-slate-400`
- Content: `p-3 flex flex-col gap-1.5`
- Actions: `px-3 pb-3 mt-auto`

### Badges

| Style | Classes |
|-------|---------|
| Overlay badge | `bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-slate-700 shadow-sm` |
| Visited | `bg-teal-500/90 text-white` |
| Events | `bg-amber-500/90 text-white` |
| Chip / tag | `bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 text-xs` |
| Priority chip (dark) | `bg-teal-900/50 text-teal-300 rounded-full px-2 py-0.5 text-xs` |

### Navigation (Navbar)

```jsx
<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50"
        style={{ borderColor: 'var(--ns-border)' }}>
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
```

- Nav links: `text-slate-600 hover:text-teal-600 text-sm`
- Logo: `<img src="/logo.png" className="h-10" />`
- Auth buttons: `.ns-btn-outline` (Log In), `.ns-btn-primary` (Sign Up)

### Inputs

**shadcn Input** (`src/components/ui/input.jsx`):
```
h-9, rounded-md, border border-input, px-3 py-1, shadow-sm
focus-visible:ring-1 ring-ring
```

**shadcn Textarea** (`src/components/ui/textarea.jsx`):
```
min-h-[60px], rounded-md, border border-input, px-3 py-2, shadow-sm
```

**Custom form inputs:**
```jsx
className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
```

**Dark mode chat input:**
```jsx
className="bg-teal-900/40 border-teal-700/50 text-white placeholder:text-white/50
           focus:border-teal-400 focus:ring-teal-400"
```

### Tab Selectors

```jsx
className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
  ${selected
    ? 'border-teal-400 text-teal-600'
    : 'border-slate-200 text-slate-700 hover:border-teal-400'}`}
```

---

## Icons

All icons come from **Lucide React** (`lucide-react`).

### Sizing Convention

| Size | Classes | Use case |
|------|---------|----------|
| Micro | `h-3 w-3`, `h-3.5 w-3.5` | Inline with text, dense lists |
| Small | `h-4 w-4` | Buttons, badges |
| Medium | `h-5 w-5` | Primary actions, nav items |
| Large | `h-8 w-8` | Avatars, feature icons |

Always add `flex-shrink-0` when icons are inside flex containers to prevent compression.

### Commonly Used Icons

| Category | Icons |
|----------|-------|
| Navigation | `ArrowLeft`, `ArrowRight`, `Menu`, `X`, `ChevronDown` |
| Actions | `Plus`, `Trash2`, `Edit2`, `Share2`, `Archive`, `Heart` |
| Status | `Check`, `CheckCircle`, `AlertTriangle`, `Circle` |
| Data | `MapPin`, `DollarSign`, `Users`, `GraduationCap`, `CalendarDays` |
| Communication | `MessageSquare`, `Mail`, `Phone`, `Globe2` |
| Features | `Sparkles` (AI), `Lock`, `Scale`, `EyeOff`, `Navigation` |

---

## Animations & Transitions

### Custom Keyframes

Defined in `globals.css` and `tailwind.config.js`.

| Animation | Keyframes | Duration | Easing |
|-----------|-----------|----------|--------|
| `fadeIn` | opacity 0→1, translateY 10px→0 | 0.5s | ease-out |
| `fade-in` (Tailwind) | opacity 0→1, translateY 8px→0 | 0.35s | ease-out forwards |
| `slideInFromRight` | translateX 100%→0, opacity 0→1 | 0.3–0.4s | ease-out |
| `slideInFromLeft` | translateX -20px/−28px→0, opacity 0→1 | 0.3–0.4s | ease-out |
| `slowFloat` | translate(0,0)→(50px,50px) scale(1→1.1) | 20s | ease-in-out infinite |
| `slowFloatReverse` | translate(0,0)→(-50px,-50px) scale(1→1.1) | 20s | ease-in-out infinite |
| `accordion-down/up` | Radix height 0↔var | 0.2s | ease-out |
| `cardFadeIn` | opacity 0→1, translateY 16px→0 | 350ms | cubic-bezier(0.22,1,0.36,1) |

### Staggered Card Entry

```jsx
style={{ animation: `cardFadeIn 350ms cubic-bezier(0.22,1,0.36,1) ${index * 60}ms both` }}
```

### Standard Transitions

| Duration | Use case |
|----------|----------|
| `150ms ease` | Buttons (`transition: all`) |
| `200ms ease-out` | Interactive cards |
| `300ms` | `transition-all duration-300` on school cards |

### Tailwind Animation Utilities

- `animate-spin` — loading spinners
- `animate-bounce` — typing indicator dots (with `animationDelay` for stagger)
- `animate-fadeIn` — general fade-in entry
- `animate-slideInFromRight` — user message bubbles
- `animate-slideInFromLeft` — AI message bubbles

---

## Shadows & Depth

| Level | Value | Use case |
|-------|-------|----------|
| Card default | `0 2px 8px rgba(0, 0, 0, 0.06)` | `.ns-card`, static cards |
| Card hover | `0 4px 12px rgba(0, 0, 0, 0.1)` | `.ns-card-interactive:hover` |
| `shadow-sm` | Tailwind default | Badges, small overlays |
| `shadow` | Tailwind default | Default buttons, shadcn cards |
| `shadow-lg` | Tailwind default | Toasts, modals |
| `shadow-2xl` | Tailwind default | Full-screen overlays |

---

## Border Radius

| Token / Class | Value | Use case |
|---------------|-------|----------|
| `--radius` (sm) | `calc(0.5rem - 4px)` = 4px | Small elements |
| `--radius` (md) | `calc(0.5rem - 2px)` = 6px | Chips, tags |
| `--radius` (lg) | `0.5rem` = 8px | Cards, inputs |
| `rounded-xl` | 12px | Panels, modals, shadcn cards |
| `rounded-2xl` | 16px | Hero cards, large containers |
| `rounded-full` / `9999px` | Pill | All `ns-btn-*` buttons, avatars, badges |

---

## Responsive Design

### Breakpoints (Tailwind defaults)

| Prefix | Min-width |
|--------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

### Common Responsive Patterns

**Progressive padding:**
```jsx
className="px-4 sm:px-6 lg:px-8"
```

**Hide on mobile:**
```jsx
className="hidden md:flex"
```

**Responsive text:**
```jsx
className="text-sm sm:text-base"
className="text-5xl sm:text-6xl"
```

**Responsive vertical spacing:**
```jsx
className="py-20 sm:py-28"
```

**Mobile scroll → desktop wrap:**
```jsx
className="overflow-x-auto sm:flex-wrap"
```

---

## Accessibility

### Focus Indicators

All interactive elements receive a teal focus ring:

```css
*:focus-visible {
  @apply outline-none ring-2 ring-offset-2;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  @apply ring-teal-600;
}
```

### Skip Link

```jsx
<a href="#main-content"
   className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
              focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white
              focus:rounded-lg">
  Skip to main content
</a>
```

---

## Dark Mode

Activated by adding the `dark` class to the `<html>` element (`darkMode: ["class"]` in Tailwind config).

### Dark Mode Variable Overrides

| Variable | Dark Value (HSL) |
|----------|------------------|
| `--background` | `222.2 84% 4.9%` (dark navy) |
| `--foreground` | `210 40% 98%` (off-white) |
| `--card` | `222.2 84% 4.9%` |
| `--primary` | `210 40% 98%` (inverted) |
| `--primary-foreground` | `222.2 47.4% 11.2%` (inverted) |
| `--secondary` | `217.2 32.6% 17.5%` |
| `--muted` | `217.2 32.6% 17.5%` |
| `--muted-foreground` | `215 20.2% 65.1%` |
| `--destructive` | `0 62.8% 30.6%` (darker red) |
| `--border` | `217.2 32.6% 17.5%` |
| `--ring` | `212.7 26.8% 83.9%` |

### Dark Mode Opacity Patterns

Use opacity modifiers for layering on dark backgrounds:

- `border-white/5`, `border-white/10`, `border-white/20` — subtle borders
- `text-white/40`, `text-white/50`, `text-white/70` — text hierarchy
- `bg-white/10` — form field backgrounds
- `bg-teal-900/50` — tinted overlays

---

## Consultant Theming

The AI consultant feature has two personas with distinct accent colors.

### Persona Colors

| Persona | Accent Color | Hex |
|---------|-------------|-----|
| Jackie | Dusty rose / mauve | `#C27B8A` |
| Liam | Slate blue | `#6B9DAD` |

Used for avatar backgrounds and markdown `<strong>` text inside consultant messages.

### Message Bubbles

| Sender | Background | Text |
|--------|-----------|------|
| User | `bg-[#f1f5f9]` (slate-100) | `text-slate-900` |
| AI | `bg-[#334155]` (slate-700) | `text-white` |

- User messages animate with `animate-slideInFromRight`
- AI messages animate with `animate-slideInFromLeft`

### Chat Input (Dark)

```
background: #1e1e2e
input: bg-teal-900/40 border-teal-700/50 text-white placeholder:text-white/50
focus: border-teal-400 ring-teal-400
```

---

## Gradient Patterns

| Context | Classes |
|---------|---------|
| Hero sections | `bg-gradient-to-br from-slate-900 to-slate-800` |
| Hero overlay | `bg-gradient-to-t from-slate-900/80 to-transparent` |
| CTA sections | `bg-gradient-to-r from-teal-50 to-amber-50` |
| Feature icons | `bg-gradient-to-br from-teal-100 to-amber-100` |
| Card placeholder | `bg-gradient-to-br from-slate-300 to-slate-400` |
| Dashboard card | `bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900` |
| School detail fallback | `bg-gradient-to-br from-[#1a2332] to-[#0f1419]` |

---

## File Reference

| File | Purpose |
|------|---------|
| `tailwind.config.js` | Theme extensions, custom animations, color variable mappings |
| `src/app/globals.css` | CSS variables, `ns-*` utility classes, keyframes, focus styles |
| `components.json` | shadcn/ui config (New York style, neutral base, Lucide icons) |
| `src/components/ui/` | 52 shadcn/ui components (do not edit manually) |
| `src/components/ui/button.jsx` | Button variants and sizes |
| `src/components/ui/card.jsx` | Card component structure |
| `src/components/ui/input.jsx` | Input styling |
| `src/components/navigation/Navbar.jsx` | Header, logo, nav links |
| `src/components/schools/SchoolCard.jsx` | School card patterns |
| `src/components/chat/ChatPanel.jsx` | Consultant persona colors |
| `src/components/chat/MessageBubble.jsx` | Message bubble styling |
