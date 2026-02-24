# Vue DevTools Overlay Implementation Analysis

## Repository Information

- **Repository**: https://github.com/vuejs/devtools-next
- **Package**: `@vue/devtools-overlay` (v8.0.6)
- **Main Path**: `/packages/overlay/`

## Architecture Overview

The Vue DevTools overlay is a standalone floating toolbar that can be dragged, positioned, and auto-hided. It consists of:

1. **Composables** - Logic for position, panel state, iframe management
2. **Components** - FrameBox (iframe container) and main App
3. **State Management** - LocalStorage-persisted state
4. **Utilities** - Helper functions for calculations

---

## Key Files and Their Roles

### 1. Position Composable (`/packages/overlay/src/composables/position.ts`)

**Purpose**: Handles drag-and-drop positioning, edge snapping, and auto-hide behavior.

#### Key Features:

**Edge Snapping Logic**:

```typescript
function snapToPoints(value: number) {
    const SNAP_THRESHOLD = 2;

    if (value < 5) return 0;
    if (value > 95) return 100;
    if (Math.abs(value - 50) < SNAP_THRESHOLD) return 50;
    return value;
}
```

**Position Detection Using Angles**:

```typescript
// Get position based on angle from viewport center
const deg = Math.atan2(y - centerY, x - centerX);
const HORIZONTAL_MARGIN = 70;
const TL = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, 0 - centerX);
const TR = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, windowWidth.value - centerX);
const BL = Math.atan2(windowHeight.value - HORIZONTAL_MARGIN - centerY, 0 - centerX);
const BR = Math.atan2(windowHeight.value - HORIZONTAL_MARGIN - centerY, windowWidth.value - centerX);

updateState({
    position: deg >= TL && deg <= TR ? "top" : deg >= TR && deg <= BR ? "right" : deg >= BR && deg <= BL ? "bottom" : "left",
    left: snapToPoints((x / windowWidth.value) * 100),
    top: snapToPoints((y / windowHeight.value) * 100),
});
```

**Auto-Hide Implementation**:

```typescript
const isHidden = computed(() => {
    if (state.value.minimizePanelInactive < 0) return false;
    if (state.value.minimizePanelInactive === 0) return true;
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    return !isDragging.value && !state.value.open && !isHovering.value && !isTouchDevice && state.value.minimizePanelInactive;
});

const bringUp = () => {
    isHovering.value = true;
    if (state.value.minimizePanelInactive < 0) return;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => {
        isHovering.value = false;
    }, +state.value.minimizePanelInactive || 0);
};
```

**Drag Handling**:

```typescript
const onPointerDown = (e: PointerEvent) => {
    isDragging.value = true;
    const { left, top, width, height } = panelEl.value!.getBoundingClientRect();
    draggingOffset.x = e.clientX - left - width / 2;
    draggingOffset.y = e.clientY - top - height / 2;
};

useEventListener("pointermove", (e) => {
    if (!isDragging.value) return;

    const centerX = windowWidth.value / 2;
    const centerY = windowHeight.value / 2;

    const x = e.clientX - draggingOffset.x;
    const y = e.clientY - draggingOffset.y;

    mousePosition.x = x;
    mousePosition.y = y;

    // Calculate angle and determine edge position...
});
```

**Safe Area Handling**:

```typescript
const safeArea = useScreenSafeArea();

watchEffect(() => {
    panelMargins.left = pixelToNumber(safeArea.left.value) + 10;
    panelMargins.top = pixelToNumber(safeArea.top.value) + 10;
    panelMargins.right = pixelToNumber(safeArea.right.value) + 10;
    panelMargins.bottom = pixelToNumber(safeArea.bottom.value) + 10;
});
```

**Panel Positioning Calculations**:

```typescript
const anchorPos = computed(() => {
    const halfWidth = (panelEl.value?.clientWidth || 0) / 2;
    const halfHeight = (panelEl.value?.clientHeight || 0) / 2;

    const left = (state.value.left * windowWidth.value) / 100;
    const top = (state.value.top * windowHeight.value) / 100;

    switch (state.value.position) {
        case "top":
            return {
                left: clamp(left, halfWidth + panelMargins.left, windowWidth.value - halfWidth - panelMargins.right),
                top: panelMargins.top + halfHeight,
            };
        case "right":
            return {
                left: windowWidth.value - panelMargins.right - halfHeight,
                top: clamp(top, halfWidth + panelMargins.top, windowHeight.value - halfWidth - panelMargins.bottom),
            };
        case "left":
            return {
                left: panelMargins.left + halfHeight,
                top: clamp(top, halfWidth + panelMargins.top, windowHeight.value - halfWidth - panelMargins.bottom),
            };
        case "bottom":
        default:
            return {
                left: clamp(left, halfWidth + panelMargins.left, windowWidth.value - halfWidth - panelMargins.right),
                top: windowHeight.value - panelMargins.bottom - halfHeight,
            };
    }
});
```

---

### 2. State Management (`/packages/overlay/src/composables/state.ts`)

**Purpose**: Manages persistent overlay state using localStorage.

```typescript
interface DevToolsFrameState {
    width: number;
    height: number;
    top: number;
    left: number;
    open: boolean;
    route: string;
    position: string;
    isFirstVisit: boolean;
    closeOnOutsideClick: boolean;
    minimizePanelInactive: number;
    preferShowFloatingPanel: boolean;
    reduceMotion: boolean;
}

const state = useLocalStorage<DevToolsFrameState>("__vue-devtools-frame-state__", {
    width: 80,
    height: 60,
    top: 0,
    left: 50,
    open: false,
    route: "/",
    position: "bottom",
    isFirstVisit: true,
    closeOnOutsideClick: false,
    minimizePanelInactive: 5000,
    preferShowFloatingPanel: true,
    reduceMotion: false,
});

export function useFrameState(): UseFrameStateReturn {
    function updateState(value: Partial<DevToolsFrameState>) {
        state.value = {
            ...state.value,
            ...value,
        };
    }

    return {
        state: readonly(state),
        updateState,
    };
}
```

**Key State Properties**:

- `width`/`height`: Panel dimensions in viewport percentages
- `top`/`left`: Panel position in viewport percentages
- `position`: Edge position ('top', 'right', 'bottom', 'left')
- `minimizePanelInactive`: Auto-hide timeout in milliseconds (5000ms default)
- `closeOnOutsideClick`: Whether clicking outside closes the panel
- `reduceMotion`: Accessibility option to disable animations

---

### 3. Panel Composable (`/packages/overlay/src/composables/panel.ts`)

**Purpose**: Manages panel visibility and keyboard shortcuts.

```typescript
export function usePanelVisible() {
    const { state, updateState } = useFrameState();
    const visible = computed({
        get() {
            return state.value.open;
        },
        set(value) {
            updateState({
                open: value,
            });
        },
    });

    const toggleVisible = (_?: unknown, state?: boolean) => {
        visible.value = state ?? !visible.value;
    };

    const closePanel = () => {
        if (!visible.value) return;
        visible.value = false;
    };

    onMounted(() => {
        useEventListener(window, "keydown", (e) => {
            // cmd + shift + D in <macOS>
            // alt + shift + D in <Windows>
            if (e.code === "KeyD" && e.altKey && e.shiftKey) toggleVisible();
        });
    });

    return {
        panelVisible: visible,
        togglePanelVisible: toggleVisible,
        closePanel,
    };
}
```

---

### 4. Main App Component (`/packages/overlay/src/App.vue`)

**Purpose**: Orchestrates the overlay UI, integrating all composables and rendering the toolbar.

#### Template Structure:

```vue
<template>
    <div
        v-show="state.preferShowFloatingPanel ? overlayVisible : panelVisible"
        ref="anchorEle"
        class="vue-devtools__anchor"
        :style="[anchorStyle, cssVars]"
        :class="{
            'vue-devtools__anchor--vertical': isVertical,
            'vue-devtools__anchor--hide': isHidden,
            fullscreen: panelState.viewMode === 'fullscreen',
            'reduce-motion': state.reduceMotion,
        }"
        @mousemove="bringUp"
    >
        <div v-if="!checkIsSafari()" class="vue-devtools__anchor--glowing" :style="isDragging ? 'opacity: 0.6 !important' : ''" />

        <!-- panel -->
        <div ref="panelEle" class="vue-devtools__panel" :style="panelStyle" @pointerdown="onPointerDown">
            <div class="vue-devtools__anchor-btn panel-entry-btn" title="Toggle Vue DevTools" @click="togglePanelVisible">
                <!-- Vue logo SVG -->
            </div>
        </div>

        <!-- iframe -->
        <FrameBox
            :style="iframeStyle"
            :is-dragging="isDragging"
            :client="{
                close: closePanel,
                getIFrame: getIframe,
            }"
            :view-mode="panelState.viewMode"
        />
    </div>
</template>
```

#### Key CSS Variables:

```typescript
const cssVars = computed(() => {
    const dark = mode.value === "dark";
    return {
        "--vue-devtools-widget-bg": dark ? "#121212" : "#ffffff",
        "--vue-devtools-widget-fg": dark ? "#F5F5F5" : "#111",
        "--vue-devtools-widget-border": dark ? "#3336" : "#efefef",
        "--vue-devtools-widget-shadow": dark ? "rgba(0,0,0,0.3)" : "rgba(128,128,128,0.1)",
    };
});
```

#### Panel Animations (SCSS):

```scss
.vue-devtools {
    &__anchor {
        position: fixed;
        z-index: 2147483645;
        transform-origin: center center;
        transform: translate(-50%, -50%) rotate(0);

        &.reduce-motion {
            transition: none !important;
            animation: none !important;
            * {
                transition: none !important;
                animation: none !important;
            }
        }

        &-btn {
            border-radius: 100%;
            border-width: 0;
            width: 30px;
            height: 30px;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0.8;
            transition: opacity 0.2s ease-in-out;

            &:hover {
                opacity: 1;
            }
        }

        &--glowing {
            position: absolute;
            left: 0;
            top: 0;
            transform: translate(-50%, -50%);
            width: 160px;
            height: 160px;
            opacity: 0;
            transition: all 1s ease;
            pointer-events: none;
            z-index: -1;
            border-radius: 9999px;
            background-image: linear-gradient(45deg, #00dc82, #36e4da, #0047e1);
            filter: blur(60px);
        }

        &:hover {
            .vue-devtools__anchor--glowing {
                opacity: 0.6;
            }
        }

        &--hide {
            .vue-devtools__panel {
                max-width: 32px;
                padding: 2px 0;
            }

            .vue-devtools__panel-content {
                opacity: 0;
            }
        }
    }

    &__panel {
        position: absolute;
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        display: flex;
        justify-content: flex-start;
        overflow: hidden;
        align-items: center;
        gap: 2px;
        height: 30px;
        padding: 4px 4px 4px 5px;
        box-sizing: border-box;
        border: 1px solid var(--vue-devtools-widget-border);
        border-radius: 20px;
        background-color: var(--vue-devtools-widget-bg);
        backdrop-filter: blur(10px);
        color: var(--vue-devtools-widget-fg);
        box-shadow: 2px 2px 8px var(--vue-devtools-widget-shadow);
        user-select: none;
        max-width: 150px;
        transition:
            max-width 0.4s ease,
            padding 0.5s ease,
            transform 0.3s ease,
            all 0.4s ease;

        &-content {
            transition: opacity 0.4s ease;
        }
    }
}
```

---

### 5. FrameBox Component (`/packages/overlay/src/components/FrameBox.vue`)

**Purpose**: Manages the resizable iframe container that holds the DevTools UI.

#### Key Features:

**Resize Handling**:

```typescript
const isResizing = ref<false | { top?: boolean; left?: boolean; right?: boolean; bottom?: boolean }>(false);

useEventListener(window, "mousemove", (e) => {
    if (!isResizing.value) return;
    if (!state.value.open) return;

    const iframe = props.client.getIFrame();
    const box = iframe.getBoundingClientRect();

    if (isResizing.value.right) {
        const widthPx = Math.abs(e.clientX - (box?.left || 0));
        const width = (widthPx / window.innerWidth) * 100;
        updateState({
            width: Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)),
        });
    } else if (isResizing.value.left) {
        const widthPx = Math.abs((box?.right || 0) - e.clientX);
        const width = (widthPx / window.innerWidth) * 100;
        updateState({
            width: Math.min(PANEL_MAX, Math.max(PANEL_MIN, width)),
        });
    }

    if (isResizing.value.top) {
        const heightPx = Math.abs((box?.bottom || 0) - e.clientY);
        const height = (heightPx / window.innerHeight) * 100;
        updateState({
            height: Math.min(PANEL_MAX, Math.max(PANEL_MIN, height)),
        });
    } else if (isResizing.value.bottom) {
        const heightPx = Math.abs(e.clientY - (box?.top || 0));
        const height = (heightPx / window.innerHeight) * 100;
        updateState({
            height: Math.min(PANEL_MAX, Math.max(PANEL_MIN, height)),
        });
    }
});
```

**Outside Click Detection**:

```typescript
useEventListener(window, "mousedown", (e: MouseEvent) => {
    if (!state.value.closeOnOutsideClick) return;
    if (!state.value.open || isResizing.value) return;

    const matched = e.composedPath().find((_el) => {
        const el = _el as HTMLElement;
        return Array.from(el.classList || []).some((c) => c.startsWith("vue-devtools")) || el.tagName?.toLowerCase() === "iframe";
    });

    if (!matched) {
        updateState({
            open: false,
        });
    }
});
```

**Template with Resize Handles**:

```vue
<template>
    <div v-show="state.open" ref="container" class="vue-devtools-frame" :class="viewModeClass">
        <!-- Handlers -->
        <div
            v-show="state.position !== 'top'"
            class="vue-devtools-resize vue-devtools-resize--horizontal"
            :style="{ top: 0 }"
            @mousedown.prevent="() => (isResizing = { top: true })"
        />
        <div
            v-show="state.position !== 'bottom'"
            class="vue-devtools-resize vue-devtools-resize--horizontal"
            :style="{ bottom: 0 }"
            @mousedown.prevent="() => (isResizing = { bottom: true })"
        />
        <div
            v-show="state.position !== 'left'"
            class="vue-devtools-resize vue-devtools-resize--vertical"
            :style="{ left: 0 }"
            @mousedown.prevent="() => (isResizing = { left: true })"
        />
        <div
            v-show="state.position !== 'right'"
            class="vue-devtools-resize vue-devtools-resize--vertical"
            :style="{ right: 0 }"
            @mousedown.prevent="() => (isResizing = { right: true })"
        />
        <!-- Corner handles -->
        <div
            v-show="state.position !== 'top' && state.position !== 'left'"
            class="vue-devtools-resize vue-devtools-resize-corner"
            :style="{ top: 0, left: 0, cursor: 'nwse-resize' }"
            @mousedown.prevent="() => (isResizing = { top: true, left: true })"
        />
        <!-- ...more corner handles... -->
    </div>
</template>
```

**Resize Handle Styles**:

```scss
.vue-devtools-resize {
    &--horizontal {
        position: absolute;
        left: 6px;
        right: 6px;
        height: 10px;
        margin: -5px 0;
        cursor: ns-resize;
        border-radius: 5px;
    }

    &--vertical {
        position: absolute;
        top: 6px;
        bottom: 0;
        width: 10px;
        margin: 0 -5px;
        cursor: ew-resize;
        border-radius: 5px;
    }

    &-corner {
        position: absolute;
        width: 14px;
        height: 14px;
        margin: -6px;
        border-radius: 6px;
    }

    &:hover {
        background: rgba(125, 125, 125, 0.1);
    }
}
```

---

### 6. Iframe Composable (`/packages/overlay/src/composables/iframe.ts`)

**Purpose**: Creates and manages the iframe element.

```typescript
export function useIframe(clientUrl: string, onLoad: () => void) {
    const iframe = ref<HTMLIFrameElement>();

    function getIframe() {
        if (iframe.value) return iframe.value;
        iframe.value = document.createElement("iframe");
        iframe.value.id = "vue-devtools-iframe";
        iframe.value.src = clientUrl;
        iframe.value.setAttribute("data-v-inspector-ignore", "true");
        iframe.value.onload = onLoad;
        return iframe.value;
    }

    return {
        getIframe,
        iframe,
    };
}
```

---

### 7. Utility Functions (`/packages/overlay/src/utils/index.ts`)

```typescript
export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export const checkIsSafari = () => navigator.userAgent.includes("Safari") && !navigator.userAgent.includes("Chrome");

export function pixelToNumber(value: string | number) {
    if (typeof value === "string") return value.endsWith("px") ? +value.slice(0, -2) : +value;
    return value;
}
```

---

### 8. Constants (`/packages/overlay/src/constants/index.ts`)

```typescript
export const PANEL_PADDING = 10;
export const PANEL_MIN = 20; // Min panel size (20% of viewport)
export const PANEL_MAX = 100; // Max panel size (100% of viewport)
```

---

### 9. Entry Point (`/packages/overlay/src/main.ts`)

**Purpose**: Initializes the overlay by creating a container and mounting the Vue app.

```typescript
import type { Component } from "vue";
import { createApp, h } from "vue";
import App from "./App.vue";

function createDevToolsContainer(App: Component) {
    const CONTAINER_ID = "__vue-devtools-container__";
    const el = document.createElement("div");
    el.setAttribute("id", CONTAINER_ID);
    el.setAttribute("data-v-inspector-ignore", "true");
    document.getElementsByTagName("body")[0].appendChild(el);
    const app = createApp({
        render: () => h(App),
        devtools: {
            hide: true,
        },
    });
    app.mount(el);
}

createDevToolsContainer(App);
```

---

## Key Implementation Patterns

### 1. Drag and Drop Positioning

**Strategy**: Angular calculation from viewport center

- Uses `Math.atan2()` to calculate angle from mouse position to viewport center
- Divides viewport into 4 quadrants (top, right, bottom, left)
- Snaps to edges based on angle thresholds
- Stores position as percentage of viewport dimensions

**Benefits**:

- Natural, intuitive dragging behavior
- Automatically determines which edge to snap to
- Works on any screen size (percentage-based)

### 2. Auto-Hide Behavior

**Strategy**: Timeout-based with hover detection

- Configurable timeout (`minimizePanelInactive`)
- Resets timer on hover (`bringUp()` function)
- Excludes touch devices from auto-hide
- Animates panel size when hidden

**Implementation Details**:

- Hidden state shrinks panel to `max-width: 32px`
- Uses opacity transitions for smooth hide/show
- Maintains dragging ability even when hidden

### 3. Edge Snapping

**Strategy**: Threshold-based snapping with center point

- Snaps to 0% when < 5%
- Snaps to 100% when > 95%
- Snaps to 50% when within 2% of center
- Provides predictable positioning

### 4. Panel Animations

**CSS Transitions**:

```scss
transition:
    max-width 0.4s ease,
    padding 0.5s ease,
    transform 0.3s ease,
    all 0.4s ease;
```

**Transform-based animations**:

- Vertical panels rotate 90deg
- Hidden panels translate with border-radius changes
- Glowing effect on hover (blur + gradient)

**Accessibility**:

- `reduce-motion` state disables all transitions
- Respects user preferences

### 5. Iframe Management

**Strategy**: Lazy creation with dynamic appending

- Creates iframe on first access
- Appends to container when panel opens
- Manages pointer events during drag/resize
- Uses `data-v-inspector-ignore` attribute

### 6. State Persistence

**Strategy**: LocalStorage with VueUse

- Uses `useLocalStorage` composable
- Stores all panel preferences
- Automatic serialization/deserialization
- Readonly state exposure with update function

### 7. Responsive Design

**Features**:

- Screen safe area awareness (notches, etc.)
- Viewport percentage-based sizing
- Clamped positioning to prevent overflow
- Dynamic margin calculations

### 8. Event Handling

**Pointer Events**:

- `pointerdown` - Start dragging
- `pointermove` - Update position during drag
- `pointerup`/`pointerleave` - End dragging

**Mouse Events**:

- `mousedown` - Start resizing, detect outside clicks
- `mousemove` - Update size during resize, trigger auto-show
- `mouseup`/`mouseleave` - End resizing

**Keyboard Events**:

- `Alt/Cmd + Shift + D` - Toggle panel visibility
- `Escape` - Close inspector mode

---

## Dependencies

From `package.json`:

```json
{
    "@vue/devtools-core": "workspace:^",
    "@vue/devtools-kit": "workspace:*",
    "@vue/devtools-shared": "workspace:^",
    "@vue/devtools-ui": "workspace:*",
    "@vueuse/core": "catalog:"
}
```

**Key VueUse Composables Used**:

- `useEventListener` - Event handling
- `useWindowSize` - Viewport dimensions
- `useScreenSafeArea` - Device safe areas
- `useLocalStorage` - State persistence

---

## File Structure Summary

```
packages/overlay/
├── src/
│   ├── components/
│   │   └── FrameBox.vue          # Resizable iframe container
│   ├── composables/
│   │   ├── iframe.ts             # Iframe creation/management
│   │   ├── index.ts              # Composables barrel export
│   │   ├── panel.ts              # Panel visibility & keyboard shortcuts
│   │   ├── position.ts           # Drag, snap, auto-hide logic
│   │   └── state.ts              # LocalStorage state management
│   ├── constants/
│   │   └── index.ts              # Panel size constraints
│   ├── utils/
│   │   └── index.ts              # Helper functions (clamp, pixelToNumber)
│   ├── App.vue                   # Main overlay component
│   └── main.ts                   # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Key Takeaways for Implementation

1. **Use angular math for edge detection** - More intuitive than boundary checking
2. **Store positions as percentages** - Responsive across different screen sizes
3. **Implement auto-hide with timers** - Better UX than always-visible
4. **Leverage VueUse composables** - Handles cross-browser event quirks
5. **Separate concerns with composables** - Position, state, panel, iframe logic
6. **Use CSS transforms for animations** - Better performance than position changes
7. **Respect accessibility preferences** - Reduced motion, keyboard shortcuts
8. **Handle safe areas** - Important for mobile devices and notched displays
9. **Persist state in localStorage** - Remember user preferences
10. **Use high z-index** - Vue DevTools uses `2147483645` to stay on top

---

## Animation Timing

- **Opacity transitions**: `0.2s - 0.4s ease-in-out`
- **Transform transitions**: `0.3s ease`
- **Size transitions**: `0.4s - 0.5s ease`
- **Glowing effect**: `1s ease`
- **Auto-hide delay**: `5000ms` (configurable)

---

## Browser Compatibility Notes

- Safari: Disables glowing effect (`checkIsSafari()`)
- Touch devices: Excludes from auto-hide behavior
- Pointer events: Uses modern pointer API for drag
- Safe areas: Handles notched displays

---

## GitHub Repository Links

- **Main Repo**: https://github.com/vuejs/devtools-next
- **Overlay Package**: https://github.com/vuejs/devtools-next/tree/main/packages/overlay
- **Position Composable**: https://github.com/vuejs/devtools-next/blob/main/packages/overlay/src/composables/position.ts
- **Panel Composable**: https://github.com/vuejs/devtools-next/blob/main/packages/overlay/src/composables/panel.ts
- **State Composable**: https://github.com/vuejs/devtools-next/blob/main/packages/overlay/src/composables/state.ts
- **App Component**: https://github.com/vuejs/devtools-next/blob/main/packages/overlay/src/App.vue
- **FrameBox Component**: https://github.com/vuejs/devtools-next/blob/main/packages/overlay/src/components/FrameBox.vue
