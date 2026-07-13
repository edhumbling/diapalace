---
name: emil-kowalski-design-and-animation
description: Applies Emil Kowalski's design engineering and web animation principles (taste, micro-interactions, scale, tooltips, custom easing, and blur tricks).
---

# Emil Kowalski's Design and Animation Guidelines

Use these principles and guidelines to build modern, tasteful, and premium web interfaces. These rules are compiled from the design engineering philosophy of Emil Kowalski (Linear, Vercel).

---

## Core Philosophy: Taste & Purpose

1. **Purposeful Animations**: Every animation must have a functional purpose (e.g., explaining state change, providing spatial consistency like sliding toasts, or visual feedback). If an animation serves no goal, remove it.
2. **Frequency of Use**:
   - **High-Frequency Actions**: Hover states, list selections, tooltip triggers, keyboard navigation, or frequently opened menus (e.g., search/command panels) should have **no transition** or **extremely fast transitions** (under `100ms`, preferably `0ms`). Delayed animations on items used hundreds of times a day cause user friction and lag.
   - **Low-Frequency Actions**: Action success notifications, form submissions, or marketing visuals can afford richer, delightful morphs.

---

## 7 Practical UI Animation Rules

### 1. Tactile Button Scale Feedback
Always scale buttons down slightly when pressed (on `:active` state) to make the interface feel responsive:
```css
button {
  transition: transform 0.1s ease-out;
}
button:active {
  transform: scale(0.97); /* 0.95 to 0.97 is ideal */
}
```

### 2. Never Animate From `scale(0)`
When elements enter the screen, do **not** transition from `scale(0)` (which looks like they pop out of nowhere). Instead, transition from a higher initial scale (e.g. `0.9` or `0.93`):
```css
.popup-enter {
  opacity: 0;
  transform: scale(0.93);
}
.popup-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease-out;
}
```

### 3. Disable Subsequent Tooltip Delay
Tooltips should have a slight initial hover delay. Once a tooltip is active, subsequent tooltips in the same group should open **instantly with 0ms transition**:
```css
.tooltip {
  transition: transform 0.125s ease-out, opacity 0.125s ease-out;
}
/* Base UI / Radix instant attribute */
.tooltip[data-instant] {
  transition-duration: 0ms;
}
```

### 4. Custom Easing & Perceived Speed
- **Avoid default CSS presets**: `ease`, `ease-in`, or default `ease-in-out` start too slow for UI entries.
- **Use `ease-out`**: Starts fast and decelerates, which maximizes perceived responsiveness.
- **Duration**: Keep UI transitions strictly under `300ms` (typically `150ms-250ms`).
- **Custom Curve**: Use strong ease-out curves (like `cubic-bezier(0.16, 1, 0.3, 1)` or curves from `easings.co`).

### 5. Origin-Aware Transitions
Popovers, dropdown menus, and dialogs should scale out from their triggering elements (buttons/icons) rather than the default `center`:
```css
/* Automatically bind via component libraries */
.dropdown-content {
  transform-origin: var(--transform-origin); /* Base UI */
  /* OR */
  transform-origin: var(--radix-dropdown-menu-content-transform-origin); /* Radix UI */
}
```

### 6. Spinner/Loader Perceived Performance
- Make loaders and spinners rotate faster. A faster-spinning loader implies that the application is working harder and makes the page load feel quicker.

### 7. The Blur Crossfade Trick
For elements that crossfade (such as tabs or icons changing state), add a subtle `filter: blur(2px)` during the transition. The blur bridges the visual gap between old and new states, tricking the eye into seeing a seamless morph instead of two distinct overlapping objects:
```css
.crossfade-item {
  transition: opacity 0.2s, filter 0.2s;
  will-change: opacity, filter;
}
.crossfade-item-changing {
  opacity: 0;
  filter: blur(2px);
}
```
