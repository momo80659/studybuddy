# Project Guide for AI Agents

## Project Overview

This is a React + TypeScript + Vite project template using shadcn/ui components and Tailwind CSS for styling.

## Design Philosophy (The "Soul" of the Product)

Every product built here must pass the **"Jony Ive Test"**: it must feel **intentional**, **coherent**, and **alive**. We do not build "utilities"; we craft "experiences".

### The Seven Design Sins to Avoid
1.  **The Sin of Flatness**: Avoiding depth, shadows, and layers. Result: "Boring", "Paper cutout".
2.  **The Sin of Clutter**: Fearing whitespace. Result: "Anxiety", "Spreadsheet".
3.  **The Sin of Stasis**: No motion, no reaction. Result: "Dead", "Broken".
4.  **The Sin of Default**: Using default colors, fonts, and layouts. Result: "Template", "Lazy".
5.  **The Sin of Silence**: No visual feedback (hover, active, focus). Result: "Numb".
6.  **The Sin of Disconnection**: Text describing what should be shown visually. Result: "Dry".
7.  **The Sin of Inconsistency**: Mixing styles or breaking patterns. Result: "Amateur".

### The Golden Standards
1.  **Breath (Whitespace)**: Space is luxury. Group elements by proximity, not by hard borders. Use generous padding (`py-12`, `py-24`).
2.  **Depth (Shadows)**: Everything exists in 3D space. Use the defined Neumorphic shadows to lift key elements. Layer with z-index.
3.  **Motion (Physics)**: Nothing in nature snaps instantly. Use the defined **Spring physics** (`src/lib/motion.ts`). Elements must fade in, slide up, and react to touch.
4.  **Narrative (Imagery)**: Images are the hero. Don't just tell; show. Use full-bleed hero images and high-quality visuals.
5. **Hierarchy (Typography)**: Guide the eye. Use dramatic scale contrast between headings and body text. Use opacity (`text-muted-foreground`) for secondary info.
    - **Typography Implementation (CRITICAL - Tailwind v4)**:
      1.  **Import**: You **MUST** import the selected Google Fonts at the top of `src/index.css`.
          - Example: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`
      2.  **Register in @theme inline**: Add font families in the `@theme inline` block in `src/index.css`:
          ```css
          @theme inline {
            --font-sans: "Inter", sans-serif;
            --font-heading: "Playfair Display", serif;
            /* ... other theme variables ... */
          }
          ```
      3.  **Selection Strategy**:
          - **Body/UI**: Always use `Inter` (clean, readable).
          - **Headings**: Choose based on "Design Philosophy":
            - *Elegant/Luxury* -> `Playfair Display` (Serif)
            - *Modern/Tech* -> `Montserrat` or `Space Grotesk` (Sans)
            - *Creative/Bold* -> `Oswald` or `Raleway`

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Routing**: React Router DOM v6
- **State Management**: Zustand, React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod validation
- **Backend**: Supabase (optional)
- **Icons**: Lucide React (UI icons), React Icons (brand/social icons)
- **Animation**: Framer Motion

## Project Structure

```
src/
├── main.tsx          # App entry point
├── App.tsx           # Root component with router setup
├── index.css         # Global styles and Tailwind imports
├── components/
│   └── ui/           # shadcn/ui components (DO NOT MODIFY)
├── pages/            # Page components (one per route)
├── hooks/            # Custom React hooks
├── lib/              # Utility functions and helpers
└── api/              # API client and data fetching
```

## Key Conventions

### File Organization
- **Pages**: One file per route in `src/pages/`, default export
- **Components**: Reusable components in `src/components/`, named exports
- **UI Components**: shadcn/ui components in `src/components/ui/` - use as-is, don't modify

### Import Aliases
- `@/` maps to `src/` (e.g., `import { Button } from "@/components/ui/button"`)

### Routing
- Use `<Link>` or `<NavLink>` from `react-router-dom` for internal navigation
- Define routes in `App.tsx`
- Use route constants instead of hardcoded paths

### Layout Conventions
- **Centered content** (landing page, blog, portfolio): use `container mx-auto px-4`
- **Full-width layout** (dashboard, sidebar layouts): do NOT use `container`, use `w-full` with inner padding
- **Note**: Tailwind v4 `container` class does NOT auto-center, always add `mx-auto` explicitly

### Design System (CRITICAL - Tailwind v4)
- **Colors**: ONLY use CSS variables registered in `@theme inline` block of `index.css`
  - Correct: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-accent`
  - Wrong: `bg-blue-500`, `text-red-600`, `border-gray-300` (arbitrary Tailwind colors)
  - Wrong: `bg-[var(--custom)]` (unregistered CSS variables won't work as Tailwind classes)
- **Adding Custom Colors**: To add a new color, you MUST:
  1. Define it in `:root` section: `--my-color: oklch(0.7 0.15 200);`
  2. Register in `@theme inline`: `--color-my-color: var(--my-color);`
  3. Now you can use: `bg-my-color`, `text-my-color`, etc.
- **Components**: ONLY use existing shadcn/ui components from `src/components/ui/`
  - DO NOT create custom button/input/dialog/card when shadcn/ui already has them
- **Consistency**: All visual design must come from design system tokens and components

### Design Language (Adaptive Depth)

**Core Formula**: `Depth = Gradient Background + Layered Shadows + Micro-interactions`

**Rules**:
- All colors via CSS variables + `color-mix()`
- Large border radius (16px-32px)
- Micro-interactions: `hover:scale-[1.02]`, `active:scale-[0.97]`, `transition-all duration-200`

**Shadow Strategy**:

1. **Containers (Cards, Panels)**: Soft outer shadow for elevation.
   ```css
   /* Soft colored glow */
   box-shadow: 0 8px 30px -6px color-mix(in srgb, var(--primary) 15%, transparent);
   ```

2. **Interactives (Buttons, Inputs)**: 3-layer structure for tactile feel.
   ```css
   box-shadow:
     /* 1. Outer colored shadow */
     0 4px 12px color-mix(in srgb, var(--primary) 35%, transparent),
     /* 2. Top subtle highlight (adaptive) */
     inset 0 1px 0 rgba(255,255,255, 0.1),
     /* 3. Bottom subtle shade */
     inset 0 -1px 0 rgba(0,0,0, 0.1);
   ```

**Forbidden**:
- `backdrop-blur` (frosted glass)
- Glow shadows (`0 0 Npx` spread)
- Hardcoded opaque colors (e.g. `#ffffff` without opacity)

**Gradient Pattern**:
```css
background: linear-gradient(135deg, 
  var(--primary) 0%, 
  color-mix(in srgb, var(--primary) 85%, black) 50%,
  color-mix(in srgb, var(--primary) 70%, black) 100%);
```

### Styling
- Use Tailwind CSS utility classes
- Use CSS variables for theming (defined in `index.css`)
- Available color tokens: `primary`, `secondary`, `accent`, `muted`, `destructive`, etc.

### Icons
- **lucide-react**: UI/system icons (Menu, X, ChevronDown, Search, etc.)
  ```tsx
  import { Menu, X, ChevronDown } from "lucide-react"
  ```
- **react-icons/si**: Brand/social media icons (use `Si` prefix)
  ```tsx
  import { SiX, SiFacebook, SiGithub, SiLinkedin } from "react-icons/si"
  ```

### Animation (Apple-style Springs with Framer Motion)

**Core Philosophy**: `Apple Motion = Spring Physics + Damped Settling + Physical Inertia`

Every animation must have:
- Natural onset (not sudden start)
- Elegant settling (not abrupt stop)
- Physical weight (like real objects moving)

**Must**:
- Use Spring physics engine
- Support `prefers-reduced-motion`
- Use design system easing curves

**Forbidden**:
- Linear easing
- Undamped bounce
- More than 3 simultaneous animations

**Pre-defined configs** in `src/lib/motion.ts`:

| Preset | Use Case | Config |
|--------|----------|--------|
| `snappy` | Buttons, hover | stiffness: 400, damping: 30 (~200ms) |
| `gentle` | Panels, modals | stiffness: 300, damping: 35 (~350ms) |
| `bouncy` | Success feedback | stiffness: 500, damping: 25 (~300ms) |
| `smooth` | Page transitions | stiffness: 200, damping: 40 (~500ms) |
| `inertia` | Lists, carousels | stiffness: 150, damping: 20 |

**Usage**:
```tsx
import { motion, AnimatePresence } from "framer-motion"
import { springPresets, fadeInUp, hoverLift, staggerContainer, staggerItem } from "@/lib/motion"

// Fade in with spring
<motion.div 
  initial={{ opacity: 0, y: 24 }} 
  animate={{ opacity: 1, y: 0 }}
  transition={springPresets.gentle}
/>

// Card hover lift (Apple Card effect)
<motion.div variants={hoverLift} initial="rest" whileHover="hover" />

// Stagger children
<motion.ul variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => <motion.li key={item.id} variants={staggerItem} />)}
</motion.ul>
```

**Exit animations**: Use short duration (150-200ms), not Spring
**Accessibility**: App wrapped with `<MotionConfig reducedMotion="user">`

### Available UI Components
accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

### Code Quality Rules (ESLint)
- No `any` type - use specific types or `unknown`
- No empty interfaces - add members or use `Record<string, never>`
- No `@ts-ignore` - use `@ts-expect-error` with explanation
- No `require()` - use ES module `import`
- No unused variables - remove or prefix with `_`
- Complete useEffect dependencies - include all referenced values

### Best Practices
- Handle loading and error states in data fetching
- Use React Query for server state management
- Memoize expensive computations with `useMemo`
- Use proper TypeScript types, avoid type assertions when possible
- Clean up effects and event listeners on unmount
