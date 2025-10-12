# Examples

Real-world examples and use cases for Boxen. These examples demonstrate practical applications you can adapt for your own projects.

## CLI Applications

### Welcome Message

```typescript
import { boxen } from "@visulima/boxen";
import { bold, cyan } from "@visulima/colorize";

function displayWelcome(appName: string, version: string): void {
    console.log(
        boxen(`Welcome to ${appName}!\n\nVersion: ${version}\nType 'help' for commands`, {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: (border) => cyan(border),
            headerText: appName.toUpperCase(),
            headerAlignment: "center",
            headerTextColor: (text) => bold(cyan(text))
        })
    );
}

displayWelcome("MyApp", "1.0.0");
```

### Update Notification

```typescript
import { boxen } from "@visulima/boxen";
import { yellow, bold } from "@visulima/colorize";

function notifyUpdate(currentVersion: string, latestVersion: string): void {
    const message = `Update available: ${currentVersion} → ${latestVersion}

Run 'npm update' to upgrade`;

    console.log(
        boxen(message, {
            padding: 1,
            margin: { top: 1, bottom: 1, left: 0, right: 0 },
            borderStyle: "bold",
            borderColor: (border) => yellow(border),
            textColor: (text) => yellow(text),
            headerText: "UPDATE AVAILABLE",
            headerAlignment: "center",
            headerTextColor: (text) => bold(yellow(text))
        })
    );
}

notifyUpdate("1.0.0", "2.0.0");
```

### Error Display

```typescript
import { boxen } from "@visulima/boxen";
import { red, bold } from "@visulima/colorize";

function displayError(error: Error): void {
    const message = `${error.message}

Stack trace:
${error.stack?.split("\n").slice(0, 5).join("\n")}`;

    console.log(
        boxen(message, {
            padding: 1,
            borderStyle: "bold",
            borderColor: (border) => red(border),
            textColor: (text) => red(text),
            headerText: "ERROR",
            headerAlignment: "center",
            headerTextColor: (text) => bold(red(text)),
            width: 80
        })
    );
}

try {
    throw new Error("Something went wrong!");
} catch (error) {
    displayError(error as Error);
}
```

### Success Confirmation

```typescript
import { boxen } from "@visulima/boxen";
import { green, bold } from "@visulima/colorize";

function displaySuccess(message: string, details?: string[]): void {
    let content = message;
    
    if (details && details.length > 0) {
        content += "\n\n" + details.map(d => `✓ ${d}`).join("\n");
    }

    console.log(
        boxen(content, {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: (border) => green(border),
            textColor: (text) => green(text),
            headerText: "SUCCESS",
            headerAlignment: "center",
            headerTextColor: (text) => bold(green(text))
        })
    );
}

displaySuccess(
    "Deployment completed successfully!",
    ["Build created", "Tests passed", "Deployed to production"]
);
```

## System Monitoring

### Server Status Dashboard

```typescript
import { boxen } from "@visulima/boxen";
import { green, yellow, cyan, bold } from "@visulima/colorize";

interface ServerStats {
    uptime: string;
    cpu: number;
    memory: number;
    requests: number;
    errors: number;
}

function displayServerStatus(stats: ServerStats): void {
    const cpuColor = stats.cpu > 80 ? yellow : green;
    const memColor = stats.memory > 80 ? yellow : green;
    
    const content = `Status: ${green("Online")}
Uptime: ${stats.uptime}

CPU Usage: ${cpuColor(stats.cpu + "%")}
Memory: ${memColor(stats.memory + "%")}
Requests: ${stats.requests.toLocaleString()}
Errors: ${stats.errors > 0 ? yellow(stats.errors.toString()) : green("0")}`;

    console.log(
        boxen(content, {
            padding: 1,
            margin: 1,
            borderStyle: "double",
            borderColor: (border) => cyan(border),
            headerText: "Server Monitor",
            headerAlignment: "center",
            headerTextColor: (text) => bold(cyan(text)),
            width: 50
        })
    );
}

displayServerStatus({
    uptime: "5d 3h 24m",
    cpu: 45,
    memory: 62,
    requests: 125430,
    errors: 3
});
```

### Build Progress

```typescript
import { boxen } from "@visulima/boxen";
import { blue, green, dim } from "@visulima/colorize";

interface BuildStep {
    name: string;
    status: "pending" | "running" | "completed" | "failed";
}

function displayBuildProgress(steps: BuildStep[]): void {
    const statusIcon = {
        pending: dim("○"),
        running: blue("◐"),
        completed: green("●"),
        failed: red("●")
    };
    
    const content = steps
        .map(step => `${statusIcon[step.status]} ${step.name}`)
        .join("\n");
    
    console.clear();
    console.log(
        boxen(content, {
            padding: 1,
            borderStyle: "single",
            borderColor: (border) => blue(border),
            headerText: "Build Progress",
            headerAlignment: "center",
            headerTextColor: (text) => blue(text),
            width: 50
        })
    );
}

const buildSteps: BuildStep[] = [
    { name: "Installing dependencies", status: "completed" },
    { name: "Compiling TypeScript", status: "running" },
    { name: "Running tests", status: "pending" },
    { name: "Building bundle", status: "pending" }
];

displayBuildProgress(buildSteps);
```

## Interactive Menus

### Main Menu

```typescript
import { boxen } from "@visulima/boxen";
import { cyan, dim } from "@visulima/colorize";

interface MenuItem {
    key: string;
    label: string;
    description?: string;
}

function displayMenu(items: MenuItem[], title: string = "Menu"): void {
    const content = items.map(item => {
        const line = `[${item.key}] ${item.label}`;
        return item.description 
            ? `${line}\n    ${dim(item.description)}` 
            : line;
    }).join("\n\n");
    
    console.log(
        boxen(content, {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: (border) => cyan(border),
            headerText: title,
            headerAlignment: "center",
            footerText: "Press the corresponding key to select",
            footerAlignment: "center",
            footerTextColor: (text) => dim(text),
            width: 60
        })
    );
}

displayMenu([
    { 
        key: "1", 
        label: "Start Server", 
        description: "Launch the development server" 
    },
    { 
        key: "2", 
        label: "Run Tests", 
        description: "Execute the test suite" 
    },
    { 
        key: "3", 
        label: "Build", 
        description: "Create production build" 
    },
    { 
        key: "q", 
        label: "Quit", 
        description: "Exit the application" 
    }
], "Development Tools");
```

### Configuration Display

```typescript
import { boxen } from "@visulima/boxen";
import { cyan, yellow, dim } from "@visulima/colorize";

interface Config {
    [key: string]: string | number | boolean;
}

function displayConfig(config: Config, title: string = "Configuration"): void {
    const content = Object.entries(config)
        .map(([key, value]) => {
            const formattedKey = cyan(key);
            const formattedValue = typeof value === "string" 
                ? yellow(`"${value}"`) 
                : yellow(String(value));
            return `${formattedKey}: ${formattedValue}`;
        })
        .join("\n");
    
    console.log(
        boxen(content, {
            padding: 1,
            margin: 1,
            borderStyle: "single",
            headerText: title,
            headerAlignment: "center",
            footerText: "Edit config with 'config set <key> <value>'",
            footerAlignment: "center",
            footerTextColor: (text) => dim(text),
            width: 60
        })
    );
}

displayConfig({
    port: 3000,
    host: "localhost",
    debug: true,
    env: "development",
    maxConnections: 100
}, "Server Configuration");
```

## Data Presentation

### Table Display

```typescript
import { boxen } from "@visulima/boxen";
import { bold, cyan } from "@visulima/colorize";

interface TableRow {
    [key: string]: string | number;
}

function displayTable(data: TableRow[], headers: string[]): void {
    const colWidths = headers.map(header => {
        const values = data.map(row => String(row[header] || "").length);
        return Math.max(header.length, ...values) + 2;
    });
    
    const headerRow = headers
        .map((header, i) => header.padEnd(colWidths[i]))
        .join(" ");
    
    const separator = colWidths
        .map(width => "─".repeat(width))
        .join("─");
    
    const rows = data.map(row =>
        headers
            .map((header, i) => 
                String(row[header] || "").padEnd(colWidths[i])
            )
            .join(" ")
    );
    
    const content = [
        bold(headerRow),
        separator,
        ...rows
    ].join("\n");
    
    console.log(
        boxen(content, {
            padding: 1,
            borderStyle: "single",
            borderColor: (border) => cyan(border)
        })
    );
}

displayTable(
    [
        { name: "Alice", age: 28, role: "Developer" },
        { name: "Bob", age: 35, role: "Designer" },
        { name: "Charlie", age: 42, role: "Manager" }
    ],
    ["name", "age", "role"]
);
```

### Key-Value Display

```typescript
import { boxen } from "@visulima/boxen";
import { cyan, yellow, bold } from "@visulima/colorize";

function displayInfo(data: Record<string, string>, title?: string): void {
    const maxKeyLength = Math.max(
        ...Object.keys(data).map(k => k.length)
    );
    
    const content = Object.entries(data)
        .map(([key, value]) => {
            const paddedKey = bold(cyan(key.padEnd(maxKeyLength)));
            return `${paddedKey} : ${yellow(value)}`;
        })
        .join("\n");
    
    console.log(
        boxen(content, {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            ...(title && {
                headerText: title,
                headerAlignment: "center" as const
            })
        })
    );
}

displayInfo(
    {
        "Name": "MyApp",
        "Version": "1.2.3",
        "Author": "John Doe",
        "License": "MIT",
        "Repository": "github.com/user/repo"
    },
    "Package Information"
);
```

## Creative Uses

### ASCII Art Frame

```typescript
import { boxen } from "@visulima/boxen";
import { rainbow } from "@visulima/colorize";

const asciiArt = `
    ╔═══╗
    ║   ║
    ╚═══╝
`;

console.log(
    boxen(asciiArt, {
        padding: 2,
        borderStyle: "double",
        borderColor: (border) => rainbow(border),
        textAlignment: "center"
    })
);
```

### Motivational Quote

```typescript
import { boxen } from "@visulima/boxen";
import { italic, bold, magenta } from "@visulima/colorize";

function displayQuote(quote: string, author: string): void {
    const content = `${italic(quote)}

${bold("— " + author)}`;
    
    console.log(
        boxen(content, {
            padding: 2,
            margin: 1,
            borderStyle: "round",
            borderColor: (border) => magenta(border),
            textColor: (text) => magenta(text),
            textAlignment: "center",
            width: 60
        })
    );
}

displayQuote(
    "The only way to do great work is to love what you do.",
    "Steve Jobs"
);
```

### Countdown Timer

```typescript
import { boxen } from "@visulima/boxen";
import { red, yellow, green, bold } from "@visulima/colorize";

function displayCountdown(seconds: number): void {
    const color = seconds <= 3 ? red : seconds <= 10 ? yellow : green;
    
    console.clear();
    console.log(
        boxen(bold(color(seconds.toString())), {
            padding: 3,
            borderStyle: "bold",
            borderColor: (border) => color(border),
            textAlignment: "center",
            float: "center"
        })
    );
}

let count = 10;
const timer = setInterval(() => {
    displayCountdown(count);
    count--;
    if (count < 0) {
        clearInterval(timer);
        console.clear();
        console.log(
            boxen("Time's up!", {
                padding: 2,
                borderStyle: "bold",
                borderColor: (border) => red(border),
                textColor: (text) => bold(red(text)),
                textAlignment: "center",
                float: "center"
            })
        );
    }
}, 1000);
```

## Integration Examples

### With Inquirer.js

```typescript
import { boxen } from "@visulima/boxen";
import inquirer from "inquirer";
import { cyan, bold } from "@visulima/colorize";

async function setupWizard() {
    console.log(
        boxen("Welcome to the setup wizard!", {
            padding: 1,
            margin: 1,
            borderStyle: "round",
            borderColor: (border) => cyan(border),
            headerText: "SETUP",
            headerAlignment: "center",
            headerTextColor: (text) => bold(cyan(text))
        })
    );
    
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "projectName",
            message: "Project name:"
        },
        {
            type: "list",
            name: "framework",
            message: "Choose a framework:",
            choices: ["React", "Vue", "Svelte"]
        }
    ]);
    
    console.log(
        boxen(`Project: ${answers.projectName}\nFramework: ${answers.framework}`, {
            padding: 1,
            margin: 1,
            borderStyle: "single",
            headerText: "Configuration Complete",
            headerAlignment: "center"
        })
    );
}
```

### With Commander.js

```typescript
import { Command } from "commander";
import { boxen } from "@visulima/boxen";
import { cyan, bold } from "@visulima/colorize";

const program = new Command();

program
    .name("myapp")
    .description("CLI application")
    .version("1.0.0")
    .action(() => {
        console.log(
            boxen(`MyApp v1.0.0

A powerful CLI tool for developers.

Use 'myapp --help' for more information.`, {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: (border) => cyan(border),
                headerText: "MyApp",
                headerAlignment: "center",
                headerTextColor: (text) => bold(cyan(text))
            })
        );
    });

program.parse();
```

## Next Steps

- **[API Reference](./api-reference.md)** - Detailed API documentation
- **[Advanced Usage](./advanced-usage.md)** - Complex customizations
- **[Styling Options](./styling-options.md)** - More styling techniques
