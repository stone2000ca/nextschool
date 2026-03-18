---
name: brand-guidelines
description: Applies NextSchool's official brand colors and typography to any sort of artifact that may benefit from having NextSchool's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.
---

# NextSchool Brand Styling

## Overview

To access NextSchool's official brand identity and style resources, use this skill.

Keywords: branding, corporate identity, visual identity, post-processing, styling, brand colors, typography, NextSchool brand, visual formatting, visual design, school platform

## Brand Guidelines

### Colors

#### Main Colors (Cream Palette)
* Cream: #F5F2ED - Primary light background
* Cream Dark: #EDE8E0 - Darker cream accent background

#### Teal Palette (Primary Brand Colors)
* Teal-900: #134E4A - Primary brand color, dark backgrounds, primary buttons
* Teal-700: #0F766E - Dark teal, hover states
* Teal-600: #0D9488 - Medium teal, outline borders
* Teal-500: #14B8A6 - Accent teal, secondary buttons
* Teal-100: #CCFBF1 - Light teal highlights
* Teal-50: #F0FDFA - Very light teal, hover backgrounds

#### Text Colors
* Primary Text: #1A1A1A - Headings and primary content
* Body Text: #4A4A4A - Body copy and paragraphs
* Secondary Text: #6B7280 - Muted/secondary content

#### UI Colors
* Border: #E5E7EB - Borders and dividers
* Card Shadow: 0 2px 8px rgba(0, 0, 0, 0.06) - Subtle card elevation
* Destructive: hsl(0 84.2% 60.2%) - Error and destructive actions

#### Chart Colors
* Chart 1: hsl(12, 76%, 61%) - Warm orange/red
* Chart 2: hsl(173, 58%, 39%) - Teal/cyan
* Chart 3: hsl(197, 37%, 24%) - Dark blue
* Chart 4: hsl(43, 74%, 66%) - Yellow/gold
* Chart 5: hsl(27, 87%, 67%) - Orange

### Typography

* Headings: Playfair Display (serif, weight 500) with Georgia fallback
* Body Text / Labels: system-ui, -apple-system, sans-serif
* Note: Playfair Display is imported from Google Fonts for best results

### Features

#### Smart Font Application
* Applies Playfair Display to all headings (h1, h2, h3)
* Uses system font stack for body text and labels
* Automatically falls back to Georgia if Playfair Display is unavailable
* Preserves readability across all systems

#### Text Styling

**Display text (ns-display):** Playfair Display, 44px, weight 500, line-height 1.1
**Heading text (ns-heading):** Playfair Display, 28px, weight 500, line-height 1.2
**Subheading text (ns-subheading):** Playfair Display, 20px, weight 500, line-height 1.3
**Label text (ns-label):** system-ui, 12px uppercase, weight 600, letter-spacing 1.2px

#### Button Styles
* All buttons use fully rounded corners (border-radius: 9999px)
* Padding: 0.75rem 1.75rem
* Font weight: 600
* Primary button (ns-btn-primary): Teal-900 background (#134E4A), Teal-700 hover (#0F766E), white text
* Secondary button (ns-btn-secondary): Teal-500 background (#14B8A6), Teal-600 hover (#0D9488), white text
* Outline button (ns-btn-outline): Teal-600 border (#0D9488), Teal-50 hover background (#F0FDFA), teal text

#### Card Styles
* Background: white
* Border radius: 8px
* Border: 1px solid #E5E7EB
* Shadow: 0 2px 8px rgba(0, 0, 0, 0.06)
* Interactive cards: hover shadow deepens + slight upward translation (-1px)

#### Shape and Accent Colors
* Non-text shapes and accents use the teal palette
* Primary accent: Teal-900 (#134E4A)
* Secondary accent: Teal-500 (#14B8A6)
* Light accent: Teal-100 (#CCFBF1)
* Charts cycle through warm orange, teal, dark blue, gold, and orange

### Technical Details

#### CSS Variables
NextSchool brand tokens are defined as CSS custom properties in `src/globals.css` with the `--ns-` prefix:
* `--ns-cream`, `--ns-cream-dark` for backgrounds
* `--ns-teal-900` through `--ns-teal-50` for the teal palette
* `--ns-text-primary`, `--ns-text-body`, `--ns-text-secondary` for text
* `--ns-border` and `--ns-card-shadow` for UI elements

#### Font Management
* Playfair Display is imported via Google Fonts: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&display=swap')`
* Falls back to Georgia for headings if unavailable
* Body text uses the system font stack for optimal performance

#### Color Application
* Use hex values for precise brand matching
* Prefer CSS variables (e.g., `var(--ns-teal-900)`) when working within the NextSchool codebase
* Use Tailwind utility classes where available (e.g., `bg-primary`, `text-foreground`)
* Maintains color fidelity across different systems

#### Design Framework
* Built on Tailwind CSS with custom theme extensions
* Uses Radix UI for accessible component primitives
* Framer Motion for animations
* Dark mode supported via class-based toggling
