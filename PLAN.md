# Plan: Custom Select Component + Missing Toolbar Select Features

## Context

The visulima dev-toolbar uses **native HTML `<select>`** elements in its settings panel (HideDelayControl, EditorControl). Compared to agentation's custom dropdown implementation, we're missing several UX features. This plan focuses on creating a custom `Select` component and upgrading the toolbar's select-related features.

## Step 1: Create `Select` UI Component

**File**: `packages/error-debugging/dev-toolbar/src/ui/components/select.tsx`

Build a custom select/dropdown component using the existing Popover + Floating UI infrastructure. Features:

- **Custom trigger** showing selected value with chevron icon
- **Dropdown panel** with option list, positioned via `@floating-ui/dom`
- **Keyboard navigation**: Arrow Up/Down to navigate, Enter to select, Escape to close, Home/End for first/last, type-ahead character search
- **ARIA attributes**: `role="listbox"`, `role="option"`, `aria-selected`, `aria-expanded`, `aria-activedescendant`
- **Scroll into view** for active option (important for EditorControl's 27 options)
- **Click outside to close** (reuse pattern from Popover)
- **Option groups** support (for categorizing editors: IDE, Terminal, Text Editor)
- **Search/filter input** (optional, for long lists like editors)
- **Consistent styling** matching existing Tailwind design tokens (bg-foreground/6, border-border, text-foreground, etc.)
- **Animation**: `animate-in fade-in-0 zoom-in-95` on open (matching Popover)
- **Dark/light mode** support via existing CSS variables
- **Shadow DOM compatible** (renders within the toolbar's shadow root)

### Component API

```tsx
interface SelectOption<T = string> {
  label: string;
  value: T;
  description?: string;   // Optional secondary text
  icon?: ComponentChildren; // Optional icon
  disabled?: boolean;
}

interface SelectOptionGroup<T = string> {
  label: string;
  options: SelectOption<T>[];
}

interface SelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[] | SelectOptionGroup<T>[];
  placeholder?: string;
  searchable?: boolean;     // Enables filter input
  disabled?: boolean;
  class?: string;
  size?: "sm" | "default";
}
```

## Step 2: Export from UI index

**File**: `packages/error-debugging/dev-toolbar/src/ui/index.ts`

Add the new Select export.

## Step 3: Migrate HideDelayControl to Custom Select

**File**: `packages/error-debugging/dev-toolbar/src/apps/settings/settings-app.tsx`

Replace the native `<select>` in `HideDelayControl` with the new custom `Select` component. Keep the same options and behavior, just with better UX:
- Consistent cross-browser styling
- Keyboard navigation
- Smooth open/close animations

## Step 4: Migrate EditorControl to Custom Select with Search

**File**: `packages/error-debugging/dev-toolbar/src/apps/settings/settings-app.tsx`

Replace the native `<select>` in `EditorControl` with the new custom `Select` component using `searchable={true}`:
- 27 editor options become filterable by typing
- Options can optionally be grouped (IDEs, Terminal editors, Text editors)
- Much better UX than scrolling through a long native dropdown

## Step 5: Add Chevron Down Icon

**File**: Need to check if `chevron-down` lucide icon is already available, otherwise add the import.

The select trigger needs a chevron indicator. Use `lucide-static/icons/chevron-down.svg` with the existing `Icon` component.

## Summary of Changes

| File | Change |
|------|--------|
| `src/ui/components/select.tsx` | **NEW** — Custom Select component |
| `src/ui/index.ts` | Add Select export |
| `src/apps/settings/settings-app.tsx` | Replace 2 native `<select>` with custom Select |

## What This Addresses

From the agentation comparison:
- **Custom styled dropdowns** instead of native `<select>` (inconsistent cross-browser)
- **Keyboard navigation** (Arrow keys, type-ahead, Home/End)
- **ARIA accessibility** (listbox/option roles, aria-activedescendant)
- **Search/filter** for long option lists
- **Consistent theming** in dark/light modes within Shadow DOM
- **Smooth animations** on open/close
- **Option descriptions** for richer context
- **Option groups** for categorization

## Out of Scope (separate tasks)

These agentation features are unrelated to the select/dropdown component:
- Element click-to-select annotation
- Animation/timer freezing
- Structured markdown output
- Server sync / webhooks
- Annotation CRUD / threading
- Color picker (agentation's is a button group, not a select)
- Demo mode
