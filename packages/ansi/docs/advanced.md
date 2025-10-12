# Advanced Usage

This guide covers advanced techniques and patterns for using `@visulima/ansi` in complex scenarios.

## Table of Contents

- [Performance Optimization](#performance-optimization)
- [Terminal Detection](#terminal-detection)
- [Alternative Screen Buffer](#alternative-screen-buffer)
- [Mouse Tracking](#mouse-tracking)
- [Complex TUI Components](#complex-tui-components)
- [Tmux and Screen Integration](#tmux-and-screen-integration)
- [Error Handling](#error-handling)
- [Memory Management](#memory-management)
- [Testing Terminal Applications](#testing-terminal-applications)

---

## Performance Optimization

### Batching Output

Instead of multiple `write()` calls, batch ANSI sequences together:

```typescript
import { cursorTo, eraseLine, cursorHide } from "@visulima/ansi";

// Less efficient
process.stdout.write(cursorHide);
process.stdout.write(cursorTo(0, 0));
process.stdout.write(eraseLine);

// More efficient
process.stdout.write(cursorHide + cursorTo(0, 0) + eraseLine);
```

### Buffered Rendering

Use a buffer to collect all changes before writing:

```typescript
import { cursorTo, eraseLine } from "@visulima/ansi/cursor";

class BufferedRenderer {
    private buffer: string[] = [];
    
    add(content: string) {
        this.buffer.push(content);
    }
    
    moveTo(x: number, y: number) {
        this.buffer.push(cursorTo(x, y));
    }
    
    clearLine() {
        this.buffer.push(eraseLine);
    }
    
    flush() {
        if (this.buffer.length > 0) {
            process.stdout.write(this.buffer.join(""));
            this.buffer = [];
        }
    }
}

// Usage
const renderer = new BufferedRenderer();
renderer.moveTo(0, 0);
renderer.clearLine();
renderer.add("Hello World");
renderer.flush(); // Single write operation
```

### Minimizing Redraws

Only redraw changed portions:

```typescript
import { cursorTo, eraseLine } from "@visulima/ansi/cursor";

class DiffRenderer {
    private lastFrame: string[] = [];
    
    render(lines: string[]) {
        lines.forEach((line, index) => {
            // Only update changed lines
            if (line !== this.lastFrame[index]) {
                process.stdout.write(cursorTo(0, index) + eraseLine + line);
                this.lastFrame[index] = line;
            }
        });
    }
}

// Usage
const renderer = new DiffRenderer();
renderer.render(["Line 1", "Line 2", "Line 3"]);
// Later, only changed lines are updated
renderer.render(["Line 1", "Changed!", "Line 3"]);
```

---

## Terminal Detection

### Detecting Terminal Capabilities

```typescript
import { env, stdout } from "process";

interface TerminalCapabilities {
    colors: boolean;
    trueColor: boolean;
    hyperlinks: boolean;
    images: boolean;
    unicode: boolean;
}

function detectCapabilities(): TerminalCapabilities {
    const termProgram = env.TERM_PROGRAM || "";
    const term = env.TERM || "";
    const colorterm = env.COLORTERM || "";
    
    return {
        colors: stdout.isTTY && term !== "dumb",
        trueColor: colorterm === "truecolor" || colorterm === "24bit",
        hyperlinks: termProgram === "iTerm.app" 
            || termProgram === "WezTerm" 
            || env.VTE_VERSION !== undefined,
        images: termProgram === "iTerm.app",
        unicode: env.LANG?.includes("UTF-8") || false
    };
}

// Usage
const caps = detectCapabilities();

if (caps.hyperlinks) {
    import("@visulima/ansi/hyperlink").then(({ default: hyperlink }) => {
        console.log(hyperlink("Click me", "https://example.com"));
    });
} else {
    console.log("Visit: https://example.com");
}
```

### Handling Different Terminal Types

```typescript
import { env } from "process";

function getTerminalType(): "iterm" | "vscode" | "windows-terminal" | "generic" {
    const termProgram = env.TERM_PROGRAM || "";
    
    if (termProgram === "iTerm.app") return "iterm";
    if (termProgram === "vscode") return "vscode";
    if (env.WT_SESSION !== undefined) return "windows-terminal";
    return "generic";
}

// Adapt behavior based on terminal
const termType = getTerminalType();

if (termType === "iterm") {
    // Use iTerm2-specific features
    import { image } from "@visulima/ansi/image";
}
```

---

## Alternative Screen Buffer

The alternative screen buffer is useful for full-screen applications:

```typescript
import { 
    alternativeScreenOn, 
    alternativeScreenOff 
} from "@visulima/ansi/alternative-screen";
import { clearScreen, cursorTo, cursorHide, cursorShow } from "@visulima/ansi";

class FullScreenApp {
    start() {
        // Switch to alternative screen
        process.stdout.write(alternativeScreenOn);
        process.stdout.write(clearScreen);
        process.stdout.write(cursorHide);
        process.stdout.write(cursorTo(0, 0));
        
        // Setup cleanup
        this.setupCleanup();
        
        // Render your app
        this.render();
    }
    
    private setupCleanup() {
        const cleanup = () => {
            process.stdout.write(cursorShow);
            process.stdout.write(alternativeScreenOff);
            process.exit(0);
        };
        
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        process.on("exit", cleanup);
    }
    
    private render() {
        // Your rendering logic
        console.log("Full screen application content");
    }
    
    stop() {
        process.stdout.write(cursorShow);
        process.stdout.write(alternativeScreenOff);
    }
}

// Usage
const app = new FullScreenApp();
app.start();

// When done
setTimeout(() => app.stop(), 5000);
```

---

## Mouse Tracking

### Basic Mouse Tracking

```typescript
import { 
    enableNormalMouse, 
    disableNormalMouse,
    enableSgrMouse,
    disableSgrMouse
} from "@visulima/ansi/mouse";
import readline from "readline";

class MouseTracker {
    private enabled = false;
    
    enable() {
        if (this.enabled) return;
        
        // Enable SGR mouse mode (better than normal)
        process.stdout.write(enableSgrMouse());
        
        // Setup stdin to receive mouse events
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        
        process.stdin.on("data", this.handleMouseData);
        this.enabled = true;
    }
    
    disable() {
        if (!this.enabled) return;
        
        process.stdout.write(disableSgrMouse());
        process.stdin.off("data", this.handleMouseData);
        
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        
        this.enabled = false;
    }
    
    private handleMouseData = (data: Buffer) => {
        const str = data.toString();
        
        // Parse SGR mouse sequence: \x1b[<b;x;yM or \x1b[<b;x;ym
        const match = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
        
        if (match) {
            const button = parseInt(match[1]);
            const x = parseInt(match[2]);
            const y = parseInt(match[3]);
            const action = match[4] === "M" ? "press" : "release";
            
            this.handleMouseEvent({ button, x, y, action });
        }
    };
    
    private handleMouseEvent(event: {
        button: number;
        x: number;
        y: number;
        action: "press" | "release";
    }) {
        console.log(`Mouse ${event.action} at (${event.x}, ${event.y}), button: ${event.button}`);
    }
}

// Usage
const tracker = new MouseTracker();
tracker.enable();

// Cleanup
process.on("exit", () => tracker.disable());
```

### Button Event Tracking

```typescript
import { enableButtonEventMouse, disableButtonEventMouse } from "@visulima/ansi/mouse";

// Enable button event tracking (tracks button presses and releases)
process.stdout.write(enableButtonEventMouse());

// Your event handling logic...

// Disable when done
process.stdout.write(disableButtonEventMouse());
```

---

## Complex TUI Components

### Resizable Component System

```typescript
import { cursorTo, eraseLine } from "@visulima/ansi/cursor";
import { clearScreen } from "@visulima/ansi/clear";

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

abstract class Component {
    constructor(protected bounds: Bounds) {}
    
    abstract render(): void;
    
    setBounds(bounds: Bounds) {
        this.bounds = bounds;
        this.render();
    }
}

class TextBox extends Component {
    constructor(bounds: Bounds, private text: string) {
        super(bounds);
    }
    
    render() {
        const lines = this.wrapText(this.text, this.bounds.width);
        
        lines.slice(0, this.bounds.height).forEach((line, i) => {
            process.stdout.write(
                cursorTo(this.bounds.x, this.bounds.y + i) + 
                eraseLine + 
                line
            );
        });
    }
    
    private wrapText(text: string, width: number): string[] {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";
        
        words.forEach(word => {
            if ((currentLine + word).length > width) {
                lines.push(currentLine.trim());
                currentLine = word + " ";
            } else {
                currentLine += word + " ";
            }
        });
        
        if (currentLine) {
            lines.push(currentLine.trim());
        }
        
        return lines;
    }
}

class Layout {
    private components: Component[] = [];
    
    addComponent(component: Component) {
        this.components.push(component);
    }
    
    render() {
        process.stdout.write(clearScreen);
        this.components.forEach(c => c.render());
    }
    
    handleResize() {
        const width = process.stdout.columns;
        const height = process.stdout.rows;
        
        // Recalculate component bounds based on new terminal size
        this.components.forEach((component, index) => {
            component.setBounds({
                x: 0,
                y: index * 5,
                width: width,
                height: 4
            });
        });
    }
}

// Usage
const layout = new Layout();
layout.addComponent(new TextBox(
    { x: 0, y: 0, width: 40, height: 4 },
    "This is a long text that will wrap to multiple lines within the box."
));

layout.render();

// Handle terminal resize
process.stdout.on("resize", () => layout.handleResize());
```

### Tabbed Interface

```typescript
import { cursorTo, cursorHide, cursorShow } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";
import { clearScreen } from "@visulima/ansi/clear";

class TabbedInterface {
    private tabs: Array<{ name: string; content: () => void }> = [];
    private activeTab: number = 0;
    
    addTab(name: string, content: () => void) {
        this.tabs.push({ name, content });
    }
    
    render() {
        process.stdout.write(cursorHide + clearScreen + cursorTo(0, 0));
        
        // Render tab headers
        const tabHeaders = this.tabs.map((tab, index) => {
            const isActive = index === this.activeTab;
            const prefix = isActive ? "[" : " ";
            const suffix = isActive ? "]" : " ";
            return `${prefix}${tab.name}${suffix}`;
        }).join("  ");
        
        console.log(tabHeaders);
        console.log("─".repeat(process.stdout.columns || 80));
        
        // Render active tab content
        process.stdout.write(cursorTo(0, 2));
        this.tabs[this.activeTab].content();
        
        process.stdout.write(cursorShow);
    }
    
    nextTab() {
        this.activeTab = (this.activeTab + 1) % this.tabs.length;
        this.render();
    }
    
    previousTab() {
        this.activeTab = (this.activeTab - 1 + this.tabs.length) % this.tabs.length;
        this.render();
    }
}

// Usage
const tabs = new TabbedInterface();

tabs.addTab("Dashboard", () => {
    console.log("Dashboard content");
});

tabs.addTab("Settings", () => {
    console.log("Settings content");
});

tabs.addTab("Help", () => {
    console.log("Help content");
});

tabs.render();
```

---

## Tmux and Screen Integration

### Detecting Tmux/Screen

```typescript
function isInTmux(): boolean {
    return process.env.TMUX !== undefined;
}

function isInScreen(): boolean {
    return process.env.TERM?.includes("screen") || false;
}
```

### Using Passthrough Sequences

```typescript
import { tmuxPassthrough, screenPassthrough } from "@visulima/ansi/passthrough";
import { cursorTo } from "@visulima/ansi/cursor";

function sendSequence(sequence: string) {
    if (isInTmux()) {
        process.stdout.write(tmuxPassthrough(sequence));
    } else if (isInScreen()) {
        process.stdout.write(screenPassthrough(sequence));
    } else {
        process.stdout.write(sequence);
    }
}

// Usage
sendSequence(cursorTo(0, 0));
```

---

## Error Handling

### Graceful Degradation

```typescript
import { cursorHide, cursorShow } from "@visulima/ansi/cursor";

class SafeRenderer {
    private cursorHidden = false;
    
    async render() {
        try {
            this.hideCursor();
            await this.doRender();
        } catch (error) {
            console.error("Render error:", error);
        } finally {
            this.showCursor();
        }
    }
    
    private hideCursor() {
        try {
            if (process.stdout.isTTY) {
                process.stdout.write(cursorHide);
                this.cursorHidden = true;
            }
        } catch (error) {
            // Fail silently if cursor hiding is not supported
        }
    }
    
    private showCursor() {
        try {
            if (this.cursorHidden && process.stdout.isTTY) {
                process.stdout.write(cursorShow);
                this.cursorHidden = false;
            }
        } catch (error) {
            // Fail silently
        }
    }
    
    private async doRender() {
        // Your rendering logic
    }
}
```

### Signal Handling

```typescript
import { cursorShow } from "@visulima/ansi/cursor";
import { alternativeScreenOff } from "@visulima/ansi/alternative-screen";

class CleanupManager {
    private cleanupHandlers: Array<() => void> = [];
    private registered = false;
    
    addCleanup(handler: () => void) {
        this.cleanupHandlers.push(handler);
        
        if (!this.registered) {
            this.registerCleanup();
            this.registered = true;
        }
    }
    
    private registerCleanup() {
        const cleanup = () => {
            this.cleanupHandlers.forEach(handler => {
                try {
                    handler();
                } catch (error) {
                    console.error("Cleanup error:", error);
                }
            });
        };
        
        // Handle various exit scenarios
        process.on("exit", cleanup);
        process.on("SIGINT", () => {
            cleanup();
            process.exit(130); // Standard SIGINT exit code
        });
        process.on("SIGTERM", () => {
            cleanup();
            process.exit(143); // Standard SIGTERM exit code
        });
        process.on("uncaughtException", (error) => {
            console.error("Uncaught exception:", error);
            cleanup();
            process.exit(1);
        });
    }
}

// Usage
const cleanup = new CleanupManager();

cleanup.addCleanup(() => {
    process.stdout.write(cursorShow);
});

cleanup.addCleanup(() => {
    process.stdout.write(alternativeScreenOff);
});
```

---

## Memory Management

### Cleaning Up Event Listeners

```typescript
class ManagedRenderer {
    private listeners: Array<() => void> = [];
    
    start() {
        const resizeListener = this.handleResize.bind(this);
        process.stdout.on("resize", resizeListener);
        
        this.listeners.push(() => {
            process.stdout.off("resize", resizeListener);
        });
    }
    
    stop() {
        this.listeners.forEach(cleanup => cleanup());
        this.listeners = [];
    }
    
    private handleResize() {
        // Handle resize
    }
}
```

### Throttling Updates

```typescript
class ThrottledRenderer {
    private updateScheduled = false;
    private lastUpdate = 0;
    private minUpdateInterval = 16; // ~60 FPS
    
    requestUpdate() {
        if (this.updateScheduled) return;
        
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdate;
        
        if (timeSinceLastUpdate >= this.minUpdateInterval) {
            this.update();
        } else {
            this.updateScheduled = true;
            setTimeout(() => {
                this.updateScheduled = false;
                this.update();
            }, this.minUpdateInterval - timeSinceLastUpdate);
        }
    }
    
    private update() {
        this.lastUpdate = Date.now();
        // Your update logic
    }
}
```

---

## Testing Terminal Applications

### Mocking stdout

```typescript
import { Writable } from "stream";

class MockStdout extends Writable {
    public output: string = "";
    
    _write(chunk: any, encoding: string, callback: () => void) {
        this.output += chunk.toString();
        callback();
    }
    
    clear() {
        this.output = "";
    }
}

// Usage in tests
import strip from "@visulima/ansi/strip";

describe("Terminal renderer", () => {
    it("renders correctly", () => {
        const mockStdout = new MockStdout();
        const originalWrite = process.stdout.write;
        
        // Replace stdout
        process.stdout.write = mockStdout.write.bind(mockStdout);
        
        // Your rendering code
        import { cursorTo } from "@visulima/ansi/cursor";
        process.stdout.write(cursorTo(0, 0) + "Hello");
        
        // Assert
        const plainOutput = strip(mockStdout.output);
        expect(plainOutput).toBe("Hello");
        
        // Restore
        process.stdout.write = originalWrite;
    });
});
```

### Testing with TTY Simulation

```typescript
class TTYSimulator {
    public columns: number = 80;
    public rows: number = 24;
    public isTTY: boolean = true;
    
    mock() {
        const original = {
            columns: process.stdout.columns,
            rows: process.stdout.rows,
            isTTY: process.stdout.isTTY
        };
        
        Object.defineProperty(process.stdout, "columns", {
            get: () => this.columns,
            configurable: true
        });
        
        Object.defineProperty(process.stdout, "rows", {
            get: () => this.rows,
            configurable: true
        });
        
        Object.defineProperty(process.stdout, "isTTY", {
            get: () => this.isTTY,
            configurable: true
        });
        
        return () => {
            // Restore original values
            Object.defineProperty(process.stdout, "columns", {
                value: original.columns,
                configurable: true
            });
            Object.defineProperty(process.stdout, "rows", {
                value: original.rows,
                configurable: true
            });
            Object.defineProperty(process.stdout, "isTTY", {
                value: original.isTTY,
                configurable: true
            });
        };
    }
}

// Usage in tests
describe("Responsive renderer", () => {
    it("adapts to terminal size", () => {
        const sim = new TTYSimulator();
        sim.columns = 40;
        sim.rows = 20;
        
        const restore = sim.mock();
        
        // Test your responsive code
        expect(process.stdout.columns).toBe(40);
        
        restore();
    });
});
```

---

## Best Practices Summary

1. **Batch operations** for better performance
2. **Always clean up** terminal state on exit
3. **Detect capabilities** before using advanced features
4. **Handle errors gracefully** with fallbacks
5. **Test in multiple terminals** for compatibility
6. **Use alternative screen** for full-screen apps
7. **Throttle updates** to avoid flickering
8. **Manage memory** by cleaning up event listeners
9. **Mock for testing** to ensure reliability

---

## Next Steps

- Review the [API Reference](./api-reference.md) for all available functions
- Check [Examples](./examples.md) for practical implementations
- Explore the source code for implementation details
