# 🎭 Layered History System Architecture

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    User Scrolls on __v_o__root              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Update Current History Index Only              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Update Background Layers Position              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Main Overlay (__v_o__root)                │   │
│  │  ✅ Content NEVER changes                           │   │
│  │  ✅ Position NEVER changes                          │   │
│  │  ✅ Always shows current error                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │        Background Layers (__v_o__history_layers)    │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Current Error (index 0)                   │   │   │
│  │  │  ❌ Hidden (shown in main overlay)         │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Previous Error (index -1)                 │   │   │
│  │  │  🎯 in-front: +50px Z, 105% scale          │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Next Error (index +1)                     │   │   │
│  │  │  🎯 behind: -50px Z, 95% scale             │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Older Errors (index +2)                   │   │   │
│  │  │  🎯 far-behind: -100px Z, 90% scale        │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Newer Errors (index -2)                   │   │   │
│  │  │  🎯 far-in-front: +100px Z, 110% scale     │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 🎯 **Main Overlay (__v_o__root)**
- **Content**: Never changes - always shows the current error
- **Position**: Never moves - stays in the same place
- **Interaction**: Receives scroll events but doesn't change content
- **Purpose**: Provides the main error display that users interact with

### 🎨 **Background Layers (__v_o__history_layers)**
- **Content**: Shows historical errors as previews
- **Position**: Changes based on scroll direction
- **3D Effects**: Different Z-depth, scale, and blur based on distance
- **Purpose**: Creates the Mac Time Machine-like depth effect

### 🖱️ **Scroll Navigation**
- **Forward Scroll**: Moves to next error in history (index +1)
- **Backward Scroll**: Moves to previous error in history (index -1)
- **Loop Navigation**: Seamlessly cycles from last to first error
- **Visual Feedback**: Background layers move to show depth progression

## CSS 3D Positioning

```css
/* Current Error (hidden in background) */
.history-overlay-layer.hidden {
    transform: translateZ(-200px) scale(0.8);
    opacity: 0;
}

/* Previous Error (in front) */
.history-overlay-layer.in-front {
    transform: translateZ(50px) scale(1.05);
    opacity: 0.8;
    filter: blur(0.5px);
}

/* Next Error (behind) */
.history-overlay-layer.behind {
    transform: translateZ(-50px) scale(0.95);
    opacity: 0.7;
    filter: blur(1px);
}

/* Far Behind */
.history-overlay-layer.far-behind {
    transform: translateZ(-100px) scale(0.9);
    opacity: 0.4;
    filter: blur(2px);
}

/* Far In Front */
.history-overlay-layer.far-in-front {
    transform: translateZ(100px) scale(1.1);
    opacity: 0.6;
    filter: blur(0px);
}
```

## Benefits

1. **🎭 Immersive Experience**: Users see historical errors in 3D space
2. **🔄 Smooth Navigation**: Only background layers move, main content stays stable
3. **👁️ Visual Depth**: Clear indication of error timeline progression
4. **⚡ Performance**: Main overlay doesn't re-render, only background layers update
5. **🎨 Mac-like UI**: True Time Machine experience with depth and perspective

## Usage

1. **Generate Errors**: Each error is added to history automatically
2. **Enable History**: Click the clock icon (🕐) to activate layered mode
3. **Scroll Navigation**: Use mouse wheel over the main overlay
4. **Visual Feedback**: See historical errors move in 3D space behind/around current
5. **Loop Navigation**: Continue scrolling to cycle through all errors seamlessly