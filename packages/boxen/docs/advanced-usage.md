# Advanced Usage

Master the advanced features of Boxen to create sophisticated terminal interfaces and dynamic content displays.

## Dynamic Box Sizing

### Fullscreen Boxes

Create boxes that fill the entire terminal:

```typescript
import { boxen } from "@visulima/boxen";

console.log(
    boxen("Fullscreen content", {
        fullscreen: true,
        padding: 2
    })
);
```

### Responsive Sizing

Control box dimensions based on terminal size:

```typescript
console.log(
    boxen("Responsive box", {
        fullscreen: (width, height) => ({
            columns: Math.floor(width * 0.8),  // 80% of terminal width
            rows: Math.floor(height * 0.5)      // 50% of terminal height
        }),
        padding: 1
    })
);
```

### Centering Content

Create a centered box with custom dimensions:

```typescript
const content = "Centered box";

console.log(
    boxen(content, {
        width: 40,
        height: 10,
        float: "center",
        textAlignment: "center",
        padding: 1
    })
);
```

## Complex Layouts

### Multi-Column Text

Create side-by-side boxes:

```typescript
const leftBox = boxen("Left column\nContent here", {
    width: 20,
    padding: 1,
    borderStyle: "single"
});

const rightBox = boxen("Right column\nMore content", {
    width: 20,
    padding: 1,
    borderStyle: "single"
});

// Note: You'll need to handle the side-by-side layout manually
// by splitting lines and concatenating them
const leftLines = leftBox.split("\n");
const rightLines = rightBox.split("\n");

leftLines.forEach((line, index) => {
    console.log(line + "  " + (rightLines[index] || ""));
});
```

### Nested Content

While you can't directly nest boxes, you can create the illusion:

```typescript
const innerContent = "Inner box";
const innerBox = boxen(innerContent, {
    padding: 1,
    borderStyle: "single"
});

const outerBox = boxen(innerBox, {
    padding: 1,
    borderStyle: "double"
});

console.log(outerBox);
```

### Dashboard Layout

Create a dashboard-style layout:

```typescript
import { boxen } from "@visulima/boxen";
import { green, yellow, red, cyan } from "@visulima/colorize";

const stats = {
    cpu: "45%",
    memory: "2.1GB",
    disk: "45GB",
    network: "1.2MB/s"
};

console.log(
    boxen(`CPU Usage: ${stats.cpu}
Memory: ${stats.memory}
Disk Space: ${stats.disk}
Network: ${stats.network}`, {
        padding: 1,
        margin: 1,
        borderStyle: "bold",
        headerText: "System Monitor",
        headerAlignment: "center",
        headerTextColor: (text) => cyan(text),
        borderColor: (border) => cyan(border)
    })
);
```

## Dynamic Content

### Progress Indicators

Create boxes with dynamic progress:

```typescript
function showProgress(percent: number): void {
    const barLength = 30;
    const filled = Math.floor((percent / 100) * barLength);
    const empty = barLength - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    
    console.clear();
    console.log(
        boxen(`${bar}\n${percent}% Complete`, {
            padding: 1,
            borderStyle: "round",
            headerText: "Installation Progress",
            headerAlignment: "center"
        })
    );
}

// Simulate progress
let progress = 0;
const interval = setInterval(() => {
    showProgress(progress);
    progress += 10;
    if (progress > 100) {
        clearInterval(interval);
    }
}, 500);
```

### Loading Animations

Create animated loading boxes:

```typescript
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let frameIndex = 0;

function showLoader(message: string): void {
    console.clear();
    console.log(
        boxen(`${frames[frameIndex]} ${message}`, {
            padding: 1,
            borderStyle: "single"
        })
    );
    frameIndex = (frameIndex + 1) % frames.length;
}

// Usage
const loader = setInterval(() => {
    showLoader("Loading data...");
}, 80);

// Stop after some time
setTimeout(() => {
    clearInterval(loader);
    console.clear();
    console.log(
        boxen("Data loaded successfully!", {
            padding: 1,
            borderStyle: "round"
        })
    );
}, 3000);
```

## Tab Handling

Control how tabs are rendered:

```typescript
// Convert tabs to 4 spaces (default)
console.log(
    boxen("Line 1\n\tIndented line\n\t\tDouble indented", {
        transformTabToSpace: 4,
        padding: 1
    })
);

// Convert tabs to 2 spaces
console.log(
    boxen("Line 1\n\tIndented line", {
        transformTabToSpace: 2,
        padding: 1
    })
);

// Disable tab transformation
console.log(
    boxen("Line 1\n\tIndented line", {
        transformTabToSpace: false,
        padding: 1
    })
);
```

## Working with Long Text

### Text Wrapping

Boxen automatically wraps text, but you can control the width:

```typescript
const longText = "This is a very long line of text that will be wrapped automatically to fit within the specified width of the box.";

console.log(
    boxen(longText, {
        width: 50,
        padding: 1
    })
);
```

### Text Truncation

For fixed-height boxes, content may be truncated:

```typescript
const multiLineText = Array(20)
    .fill("Line of text")
    .join("\n");

console.log(
    boxen(multiLineText, {
        height: 10,
        padding: 1,
        footerText: "Content truncated",
        footerAlignment: "center"
    })
);
```

## Conditional Styling

Apply different styles based on conditions:

```typescript
function createAlertBox(
    message: string, 
    level: "info" | "warning" | "error" | "success"
) {
    const styles = {
        info: {
            borderStyle: "single" as const,
            borderColor: (border: string) => blue(border),
            headerText: "INFO"
        },
        warning: {
            borderStyle: "double" as const,
            borderColor: (border: string) => yellow(border),
            headerText: "WARNING"
        },
        error: {
            borderStyle: "bold" as const,
            borderColor: (border: string) => red(border),
            headerText: "ERROR"
        },
        success: {
            borderStyle: "round" as const,
            borderColor: (border: string) => green(border),
            headerText: "SUCCESS"
        }
    };
    
    return boxen(message, {
        ...styles[level],
        padding: 1,
        headerAlignment: "center"
    });
}

// Usage
console.log(createAlertBox("Server started", "success"));
console.log(createAlertBox("Disk space low", "warning"));
console.log(createAlertBox("Connection failed", "error"));
console.log(createAlertBox("New update available", "info"));
```

## Performance Optimization

### Caching Box Configurations

For frequently used box styles:

```typescript
const defaultBoxOptions = {
    padding: 1,
    borderStyle: "single" as const,
    textAlignment: "left" as const
};

// Reuse configuration
console.log(boxen("Message 1", defaultBoxOptions));
console.log(boxen("Message 2", defaultBoxOptions));
console.log(boxen("Message 3", defaultBoxOptions));
```

### Batch Processing

When displaying multiple boxes:

```typescript
const messages = [
    "First message",
    "Second message",
    "Third message"
];

const boxes = messages.map(msg => 
    boxen(msg, {
        padding: 1,
        margin: { bottom: 1 }
    })
);

// Display all at once
console.log(boxes.join("\n"));
```

## Interactive CLIs

### Menu Systems

Create interactive menu boxes:

```typescript
import { boxen } from "@visulima/boxen";

function displayMenu(options: string[], selected: number): void {
    const menuText = options
        .map((option, index) => {
            const prefix = index === selected ? "▶" : " ";
            return `${prefix} ${option}`;
        })
        .join("\n");
    
    console.clear();
    console.log(
        boxen(menuText, {
            padding: 1,
            borderStyle: "round",
            headerText: "Main Menu",
            headerAlignment: "center",
            footerText: "Use ↑↓ to navigate, Enter to select",
            footerAlignment: "center"
        })
    );
}

// Usage
displayMenu(["Start Game", "Settings", "Exit"], 0);
```

### Confirmation Dialogs

```typescript
function confirmDialog(message: string, defaultYes: boolean = true): string {
    const prompt = defaultYes ? "[Y/n]" : "[y/N]";
    
    return boxen(`${message}\n\n${prompt}`, {
        padding: 1,
        borderStyle: "bold",
        width: 50,
        textAlignment: "center",
        headerText: "Confirmation",
        headerAlignment: "center"
    });
}

console.log(confirmDialog("Are you sure you want to delete this file?"));
```

## Best Practices

### Responsive Design

Always consider terminal width:

```typescript
import terminalSize from "terminal-size";

const { columns } = terminalSize();
const maxWidth = Math.min(columns - 4, 80); // Leave some margin

console.log(
    boxen("Responsive content", {
        width: maxWidth,
        padding: 1
    })
);
```

### Error Handling

Handle cases where terminal size can't be determined:

```typescript
try {
    console.log(
        boxen("Content", {
            fullscreen: true
        })
    );
} catch (error) {
    // Fallback to fixed width
    console.log(
        boxen("Content", {
            width: 60,
            padding: 1
        })
    );
}
```

### Accessibility

Keep boxes accessible:

- Use clear, high-contrast colors
- Provide text alternatives for color-coded information
- Test with screen readers when possible
- Avoid overly complex layouts

## Next Steps

- **[Examples](./examples.md)** - See complete real-world examples
- **[API Reference](./api-reference.md)** - Detailed API documentation
- **[FAQ](./faq.md)** - Common questions and solutions
