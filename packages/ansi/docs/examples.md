---
title: Examples
description: Practical examples and real-world use cases for @visulima/ansi
---

import { Callout } from 'fumadocs-ui/components/callout';

Practical, real-world examples of using `@visulima/ansi` in your applications.

## Loading Spinner

Create an animated loading spinner:

```typescript title="spinner.ts"
import { cursorHide, cursorShow } from "@visulima/ansi/cursor";
import { eraseLine, cursorLeft } from "@visulima/ansi";

async function loadingSpinner(message: string, duration: number = 3000) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frameIndex = 0;
    
    process.stdout.write(cursorHide);
    
    const interval = setInterval(() => {
        process.stdout.write(cursorLeft + eraseLine);
        process.stdout.write(`${frames[frameIndex]} ${message}`);
        frameIndex = (frameIndex + 1) % frames.length;
    }, 80);
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    clearInterval(interval);
    process.stdout.write(cursorLeft + eraseLine);
    process.stdout.write(cursorShow);
}

// Usage
await loadingSpinner("Loading data...");
console.log("Done!");
```

## Progress Bar

Display a progress bar with percentage:

```typescript title="progress-bar.ts"
import { cursorHide, cursorShow, cursorTo } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";

class ProgressBar {
    private total: number;
    private current: number = 0;
    private barLength: number = 40;
    
    constructor(total: number) {
        this.total = total;
        process.stdout.write(cursorHide);
    }
    
    update(value: number) {
        this.current = value;
        this.render();
    }
    
    increment() {
        this.current++;
        this.render();
    }
    
    private render() {
        const percentage = Math.floor((this.current / this.total) * 100);
        const filled = Math.floor((this.current / this.total) * this.barLength);
        const empty = this.barLength - filled;
        
        const bar = "█".repeat(filled) + "░".repeat(empty);
        
        process.stdout.write(cursorTo(0) + eraseLine);
        process.stdout.write(`Progress: [${bar}] ${percentage}% (${this.current}/${this.total})`);
        
        if (this.current >= this.total) {
            process.stdout.write("\n" + cursorShow);
        }
    }
}

// Usage
async function processItems(items: any[]) {
    const progress = new ProgressBar(items.length);
    
    for (let i = 0; i < items.length; i++) {
        // Process item...
        await new Promise(resolve => setTimeout(resolve, 100));
        progress.update(i + 1);
    }
}

await processItems(new Array(50).fill(null));
```

## Interactive Menu

Create a keyboard-navigable menu:

<Callout>
This example requires user input handling with the `readline` module.
</Callout>

```typescript title="menu.ts"
import { cursorUp, cursorTo, cursorHide, cursorShow } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";
import readline from "readline";

class Menu {
    private options: string[];
    private selectedIndex: number = 0;
    private rendered: boolean = false;
    
    constructor(options: string[]) {
        this.options = options;
    }
    
    private render() {
        if (this.rendered) {
            process.stdout.write(cursorUp(this.options.length));
        }
        
        this.options.forEach((option, index) => {
            process.stdout.write(cursorTo(0) + eraseLine);
            const prefix = index === this.selectedIndex ? "→ " : "  ";
            const style = index === this.selectedIndex ? "\x1b[1m" : "\x1b[0m";
            console.log(`${prefix}${style}${option}\x1b[0m`);
        });
        
        this.rendered = true;
    }
    
    async show(): Promise<string> {
        return new Promise((resolve) => {
            process.stdout.write(cursorHide);
            this.render();
            
            readline.emitKeypressEvents(process.stdin);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            
            const onKeypress = (str: string, key: any) => {
                if (key.name === "up") {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                    this.render();
                } else if (key.name === "down") {
                    this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
                    this.render();
                } else if (key.name === "return") {
                    process.stdin.off("keypress", onKeypress);
                    if (process.stdin.isTTY) {
                        process.stdin.setRawMode(false);
                    }
                    process.stdout.write(cursorShow);
                    resolve(this.options[this.selectedIndex]);
                } else if (key.ctrl && key.name === "c") {
                    process.exit();
                }
            };
            
            process.stdin.on("keypress", onKeypress);
        });
    }
}

// Usage
const menu = new Menu([
    "Start Server",
    "Run Tests",
    "Build Project",
    "Exit"
]);

const selected = await menu.show();
console.log(`\nYou selected: ${selected}`);
```

## Terminal Dashboard

Create a live-updating dashboard:

```typescript title="dashboard.ts"
import { cursorTo, cursorHide, cursorShow } from "@visulima/ansi/cursor";
import { clearScreen } from "@visulima/ansi/clear";

interface DashboardData {
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
}

class Dashboard {
    private running: boolean = false;
    private interval: NodeJS.Timeout | null = null;
    
    start(getData: () => DashboardData) {
        this.running = true;
        process.stdout.write(cursorHide + clearScreen);
        
        this.interval = setInterval(() => {
            const data = getData();
            this.render(data);
        }, 1000);
        
        // Initial render
        this.render(getData());
    }
    
    stop() {
        this.running = false;
        if (this.interval) {
            clearInterval(this.interval);
        }
        process.stdout.write(cursorShow);
    }
    
    private render(data: DashboardData) {
        process.stdout.write(cursorTo(0, 0));
        
        console.log("═══════════════════════════════════");
        console.log("      System Dashboard");
        console.log("═══════════════════════════════════");
        console.log("");
        console.log(`  CPU Usage:    ${this.bar(data.cpu)} ${data.cpu}%`);
        console.log(`  Memory:       ${this.bar(data.memory)} ${data.memory}%`);
        console.log("");
        console.log(`  Requests:     ${data.requests.toLocaleString()}`);
        console.log(`  Errors:       ${data.errors.toLocaleString()}`);
        console.log("");
        console.log(`  Updated: ${new Date().toLocaleTimeString()}`);
        console.log("");
        console.log("  Press Ctrl+C to exit");
    }
    
    private bar(percentage: number, length: number = 20): string {
        const filled = Math.floor((percentage / 100) * length);
        return "█".repeat(filled) + "░".repeat(length - filled);
    }
}

// Usage
const dashboard = new Dashboard();

dashboard.start(() => ({
    cpu: Math.floor(Math.random() * 100),
    memory: Math.floor(Math.random() * 100),
    requests: Math.floor(Math.random() * 10000),
    errors: Math.floor(Math.random() * 100)
}));

// Stop after 10 seconds
setTimeout(() => dashboard.stop(), 10000);
```

## Log Stream with Updates

Display a log stream that updates in place:

```typescript title="log-stream.ts"
import { cursorUp, cursorTo } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";

class LogStream {
    private logs: string[] = [];
    private maxLines: number;
    
    constructor(maxLines: number = 10) {
        this.maxLines = maxLines;
    }
    
    add(message: string) {
        this.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (this.logs.length > this.maxLines) {
            this.logs.shift();
        }
        this.render();
    }
    
    private render() {
        // Move cursor up to start of log area
        if (this.logs.length > 1) {
            process.stdout.write(cursorUp(Math.min(this.logs.length - 1, this.maxLines)));
        }
        
        // Render all logs
        this.logs.forEach(log => {
            process.stdout.write(cursorTo(0) + eraseLine);
            console.log(log);
        });
    }
}

// Usage
const logger = new LogStream(5);

logger.add("Application started");
await new Promise(r => setTimeout(r, 1000));

logger.add("Connected to database");
await new Promise(r => setTimeout(r, 1000));

logger.add("Server listening on port 3000");
await new Promise(r => setTimeout(r, 1000));

logger.add("Received first request");
```

## Table Display

Display and update a table:

```typescript title="table.ts"
import { cursorTo, cursorUp } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";

interface TableRow {
    id: number;
    name: string;
    status: string;
    progress: number;
}

class Table {
    private rows: TableRow[] = [];
    private rendered: boolean = false;
    
    setRows(rows: TableRow[]) {
        this.rows = rows;
        this.render();
    }
    
    updateRow(id: number, updates: Partial<TableRow>) {
        const index = this.rows.findIndex(r => r.id === id);
        if (index !== -1) {
            this.rows[index] = { ...this.rows[index], ...updates };
            this.render();
        }
    }
    
    private render() {
        if (this.rendered) {
            // Move cursor up to start of table (header + rows + separator)
            process.stdout.write(cursorUp(this.rows.length + 2));
        }
        
        // Header
        process.stdout.write(cursorTo(0) + eraseLine);
        console.log("ID  | Name          | Status      | Progress");
        process.stdout.write(cursorTo(0) + eraseLine);
        console.log("─────────────────────────────────────────────");
        
        // Rows
        this.rows.forEach(row => {
            process.stdout.write(cursorTo(0) + eraseLine);
            const progressBar = "█".repeat(row.progress / 10) + "░".repeat(10 - row.progress / 10);
            console.log(
                `${String(row.id).padEnd(4)}| ${row.name.padEnd(14)}| ${row.status.padEnd(12)}| ${progressBar}`
            );
        });
        
        this.rendered = true;
    }
}

// Usage
const table = new Table();

table.setRows([
    { id: 1, name: "Task Alpha", status: "Running", progress: 0 },
    { id: 2, name: "Task Beta", status: "Pending", progress: 0 },
    { id: 3, name: "Task Gamma", status: "Pending", progress: 0 }
]);

// Simulate progress
for (let i = 0; i <= 100; i += 10) {
    await new Promise(r => setTimeout(r, 200));
    table.updateRow(1, { progress: i });
}
table.updateRow(1, { status: "Complete" });

for (let i = 0; i <= 100; i += 10) {
    await new Promise(r => setTimeout(r, 200));
    table.updateRow(2, { status: "Running", progress: i });
}
table.updateRow(2, { status: "Complete" });
```

## Countdown Timer

Create a countdown timer:

```typescript title="countdown.ts"
import { cursorLeft } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";

async function countdown(seconds: number, message: string = "Time remaining") {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(cursorLeft + eraseLine);
        process.stdout.write(`${message}: ${i}s`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    process.stdout.write(cursorLeft + eraseLine);
    console.log("Time's up!");
}

// Usage
await countdown(10, "Starting in");
```

## Status Messages

Display status messages with icons:

```typescript title="status.ts"
import { cursorTo } from "@visulima/ansi/cursor";
import { eraseLine } from "@visulima/ansi/erase";

class StatusReporter {
    async task(message: string, fn: () => Promise<void>) {
        process.stdout.write(`⏳ ${message}...`);
        
        try {
            await fn();
            process.stdout.write(cursorTo(0) + eraseLine);
            console.log(`✓ ${message}`);
        } catch (error) {
            process.stdout.write(cursorTo(0) + eraseLine);
            console.log(`✗ ${message}`);
            throw error;
        }
    }
}

// Usage
const reporter = new StatusReporter();

await reporter.task("Connecting to database", async () => {
    await new Promise(r => setTimeout(r, 1000));
});

await reporter.task("Loading configuration", async () => {
    await new Promise(r => setTimeout(r, 800));
});

await reporter.task("Starting server", async () => {
    await new Promise(r => setTimeout(r, 1200));
});

console.log("\nAll tasks completed!");
```

## Creating Hyperlinks

Display clickable links in supported terminals:

<Callout type="warn">
Hyperlink support varies by terminal. Test in your target environment.
</Callout>

```typescript title="hyperlinks.ts"
import hyperlink from "@visulima/ansi/hyperlink";

// Simple link
console.log(`Visit ${hyperlink("our website", "https://visulima.com")} for more info`);

// Multiple links
const links = [
    { text: "Documentation", url: "https://visulima.com/docs" },
    { text: "GitHub", url: "https://github.com/visulima/visulima" },
    { text: "npm", url: "https://www.npmjs.com/package/@visulima/ansi" }
];

console.log("\nUseful links:");
links.forEach(link => {
    console.log(`  - ${hyperlink(link.text, link.url)}`);
});
```

## Stripping ANSI Codes

Remove ANSI codes for logging or length calculation:

```typescript title="strip-ansi.ts"
import strip from "@visulima/ansi/strip";
import { cursorUp } from "@visulima/ansi/cursor";

// Calculate actual text length
const styledText = "\x1b[32mHello\x1b[0m \x1b[1mWorld\x1b[0m";
const plainText = strip(styledText);

console.log(`Styled length: ${styledText.length}`);      // Much longer
console.log(`Actual length: ${plainText.length}`);       // 11

// Save to log file without ANSI codes
import { writeFileSync } from "fs";

const logEntry = `${new Date().toISOString()} ${cursorUp(1)}${styledText}`;
const cleanLogEntry = `${new Date().toISOString()} ${strip(logEntry)}`;

writeFileSync("app.log", cleanLogEntry + "\n", { flag: "a" });
```

## Next Steps

- Check the [API Reference](./api-reference.md) for complete function documentation
- Read [Advanced Usage](./advanced.md) for complex scenarios
- Explore the source code for more implementation details
