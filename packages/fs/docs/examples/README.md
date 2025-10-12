# Examples

Practical examples demonstrating common use cases with @visulima/fs.

## Table of Contents

1. [Basic File Operations](#basic-file-operations)
2. [Configuration Management](#configuration-management)
3. [Project Setup Scripts](#project-setup-scripts)
4. [Build Tools](#build-tools)
5. [CLI Applications](#cli-applications)
6. [Testing Utilities](#testing-utilities)
7. [Migration Scripts](#migration-scripts)
8. [Monorepo Management](#monorepo-management)

## Basic File Operations

### Reading and Writing Files

```typescript
import { readFile, writeFile } from "@visulima/fs";

// Read text file
const content = await readFile("./README.md");
console.log(content);

// Write text file
await writeFile("./output.txt", "Hello, World!");

// Read binary file
const imageBuffer = await readFile("./logo.png", { buffer: true });

// Write with options
await writeFile("./config.txt", "data", {
    mode: 0o644,
    encoding: "utf8",
});
```

### Working with JSON

```typescript
import { readJson, writeJson } from "@visulima/fs";

// Read package.json
const pkg = await readJson("./package.json");
console.log(pkg.name, pkg.version);

// Update and write
pkg.version = "2.0.0";
await writeJson("./package.json", pkg, {
    indent: 2,
    detectIndent: true,
});

// Read with error handling
import { JSONError, NotFoundError } from "@visulima/fs/error";

try {
    const config = await readJson("./config.json");
} catch (error) {
    if (error instanceof NotFoundError) {
        // Create default config
        await writeJson("./config.json", { default: true }, { indent: 2 });
    } else if (error instanceof JSONError) {
        console.error("Invalid JSON:", error.codeFrame);
    }
}
```

### Working with YAML

```typescript
import { readYaml, writeYaml } from "@visulima/fs/yaml";

// Read YAML config
const config = await readYaml("./config.yml");

// Write YAML
await writeYaml("./output.yml", {
    database: {
        host: "localhost",
        port: 5432,
    },
    cache: {
        enabled: true,
        ttl: 3600,
    },
});
```

## Configuration Management

### Multi-Environment Config Loader

```typescript
import { readJson, writeJson, findUp } from "@visulima/fs";
import { existsSync } from "node:fs";

interface Config {
    api: {
        url: string;
        timeout: number;
    };
    features: Record<string, boolean>;
}

async function loadConfig(env: string = "development"): Promise<Config> {
    // Find config directory
    const configDir = await findUp("config", { type: "directory" });
    
    if (!configDir) {
        throw new Error("Config directory not found");
    }
    
    // Load base config
    const baseConfig = await readJson<Config>(`${configDir}/base.json`);
    
    // Load environment-specific config
    const envConfigPath = `${configDir}/${env}.json`;
    let envConfig: Partial<Config> = {};
    
    if (existsSync(envConfigPath)) {
        envConfig = await readJson(envConfigPath);
    }
    
    // Merge configs
    return {
        ...baseConfig,
        ...envConfig,
        api: { ...baseConfig.api, ...envConfig.api },
        features: { ...baseConfig.features, ...envConfig.features },
    };
}

// Usage
const config = await loadConfig(process.env.NODE_ENV);
```

### Config with Validation

```typescript
import { readJson, writeJson } from "@visulima/fs";

interface AppConfig {
    port: number;
    host: string;
    debug: boolean;
}

function validateConfig(config: unknown): config is AppConfig {
    return (
        typeof config === "object" &&
        config !== null &&
        "port" in config &&
        typeof config.port === "number" &&
        "host" in config &&
        typeof config.host === "string" &&
        "debug" in config &&
        typeof config.debug === "boolean"
    );
}

async function loadValidatedConfig(path: string): Promise<AppConfig> {
    const config = await readJson(path);
    
    if (!validateConfig(config)) {
        throw new Error("Invalid configuration");
    }
    
    return config;
}

// Usage
const config = await loadValidatedConfig("./config.json");
```

## Project Setup Scripts

### Initialize Project Structure

```typescript
import { ensureDir, writeFile, writeJson } from "@visulima/fs";

async function initializeProject(name: string) {
    console.log(`Creating project: ${name}`);
    
    // Create directory structure
    await ensureDir(`./${name}/src`);
    await ensureDir(`./${name}/tests`);
    await ensureDir(`./${name}/docs`);
    
    // Create package.json
    await writeJson(`./${name}/package.json`, {
        name,
        version: "1.0.0",
        main: "src/index.ts",
        scripts: {
            test: "vitest",
            build: "tsc",
        },
    }, { indent: 2 });
    
    // Create README
    await writeFile(`./${name}/README.md`, `# ${name}\n\nProject description.`);
    
    // Create .gitignore
    await writeFile(`./${name}/.gitignore`, [
        "node_modules/",
        "dist/",
        ".env",
        "*.log",
    ].join("\n"));
    
    // Create index file
    await writeFile(`./${name}/src/index.ts`, `export function hello() {
  return "Hello, World!";
}
`);
    
    console.log("Project initialized successfully!");
}

// Usage
await initializeProject("my-project");
```

### Generate Component Boilerplate

```typescript
import { ensureDir, writeFile } from "@visulima/fs";

async function generateComponent(name: string) {
    const componentDir = `./src/components/${name}`;
    
    await ensureDir(componentDir);
    
    // Component file
    await writeFile(`${componentDir}/${name}.tsx`, `
interface ${name}Props {
  // Props here
}

export function ${name}(props: ${name}Props) {
  return <div>{/* Component content */}</div>;
}
`.trim());
    
    // Test file
    await writeFile(`${componentDir}/${name}.test.tsx`, `
import { ${name} } from "./${name}";

describe("${name}", () => {
  it("renders correctly", () => {
    // Test here
  });
});
`.trim());
    
    // Index file
    await writeFile(`${componentDir}/index.ts`, `export { ${name} } from "./${name}";\n`);
    
    console.log(`Component ${name} created successfully!`);
}

// Usage
await generateComponent("Button");
```

## Build Tools

### Bundle Size Reporter

```typescript
import { gzipSize, brotliSize, rawSize } from "@visulima/fs/size";
import { collect, writeJson } from "@visulima/fs";

async function generateBundleReport(buildDir: string) {
    const entries = await collect(buildDir, {
        extensions: [".js", ".css"],
        includeDirs: false,
    });
    
    const report = await Promise.all(
        entries.map(async (entry) => {
            const [raw, gzip, brotli] = await Promise.all([
                rawSize(entry.path),
                gzipSize(entry.path),
                brotliSize(entry.path),
            ]);
            
            return {
                file: entry.name,
                raw,
                gzip,
                brotli,
                compression: {
                    gzip: ((gzip / raw) * 100).toFixed(1) + "%",
                    brotli: ((brotli / raw) * 100).toFixed(1) + "%",
                },
            };
        })
    );
    
    // Sort by raw size descending
    report.sort((a, b) => b.raw - a.raw);
    
    // Write report
    await writeJson("./bundle-report.json", {
        timestamp: new Date().toISOString(),
        bundles: report,
    }, { indent: 2 });
    
    // Console output
    console.table(report);
    
    return report;
}

// Usage
await generateBundleReport("./dist");
```

### Asset Optimizer

```typescript
import { walk, readFile, writeFile } from "@visulima/fs";
import { format, LF } from "@visulima/fs/eol";

async function optimizeAssets(directory: string) {
    for await (const entry of walk(directory, {
        extensions: [".js", ".ts", ".json", ".md"],
        skip: ["node_modules", "dist"],
    })) {
        if (!entry.isFile) continue;
        
        let content = await readFile(entry.path);
        let modified = false;
        
        // Normalize line endings
        if (content.includes("\r\n")) {
            content = format(content, LF);
            modified = true;
        }
        
        // Remove trailing whitespace
        const lines = content.split("\n");
        const trimmed = lines.map(line => line.trimEnd()).join("\n");
        
        if (trimmed !== content) {
            content = trimmed;
            modified = true;
        }
        
        // Write back if modified
        if (modified) {
            await writeFile(entry.path, content);
            console.log(`Optimized: ${entry.path}`);
        }
    }
}

// Usage
await optimizeAssets("./src");
```

## CLI Applications

### File Processor CLI

```typescript
import { walk, readFile, writeFile, ensureDir } from "@visulima/fs";
import { basename, dirname, join } from "node:path";

async function processFiles(
    input: string,
    output: string,
    processor: (content: string) => string
) {
    for await (const entry of walk(input, { includeDirs: false })) {
        // Calculate output path
        const relativePath = entry.path.replace(input, "");
        const outputPath = join(output, relativePath);
        
        // Ensure output directory exists
        await ensureDir(dirname(outputPath));
        
        // Process file
        const content = await readFile(entry.path);
        const processed = processor(content);
        
        // Write output
        await writeFile(outputPath, processed);
        
        console.log(`Processed: ${entry.name}`);
    }
}

// Usage: Convert to uppercase
await processFiles(
    "./input",
    "./output",
    (content) => content.toUpperCase()
);
```

### Project Analyzer

```typescript
import { findUp, readJson, collect } from "@visulima/fs";
import { dirname } from "node:path";

async function analyzeProject() {
    // Find project root
    const packageJsonPath = await findUp("package.json");
    
    if (!packageJsonPath) {
        throw new Error("Not in a Node.js project");
    }
    
    const projectRoot = dirname(packageJsonPath);
    const pkg = await readJson(packageJsonPath);
    
    // Count files by extension
    const entries = await collect(projectRoot, {
        skip: ["node_modules", ".git", "dist"],
    });
    
    const stats = {
        name: pkg.name,
        version: pkg.version,
        totalFiles: 0,
        byExtension: {} as Record<string, number>,
        totalSize: 0,
    };
    
    for (const entry of entries) {
        if (entry.isFile) {
            stats.totalFiles++;
            
            const ext = entry.name.includes(".")
                ? entry.name.split(".").pop() || "none"
                : "none";
            
            stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
        }
    }
    
    console.log(stats);
    return stats;
}

// Usage
await analyzeProject();
```

## Testing Utilities

### Test Fixture Manager

```typescript
import { ensureDir, writeFile, remove, emptyDir } from "@visulima/fs";
import { join } from "node:path";

class FixtureManager {
    private fixtureDir: string;
    
    constructor(testName: string) {
        this.fixtureDir = join("./test-fixtures", testName);
    }
    
    async setup() {
        await ensureDir(this.fixtureDir);
    }
    
    async createFile(path: string, content: string) {
        const fullPath = join(this.fixtureDir, path);
        await writeFile(fullPath, content);
        return fullPath;
    }
    
    async cleanup() {
        await remove(this.fixtureDir);
    }
    
    getPath(path: string = "") {
        return join(this.fixtureDir, path);
    }
}

// Usage in tests
import { describe, it, beforeEach, afterEach } from "vitest";

describe("File processor", () => {
    const fixtures = new FixtureManager("file-processor");
    
    beforeEach(async () => {
        await fixtures.setup();
    });
    
    afterEach(async () => {
        await fixtures.cleanup();
    });
    
    it("processes files", async () => {
        const file = await fixtures.createFile("input.txt", "test");
        // Test using file
    });
});
```

See the [Advanced Guides](../advanced/README.md) for more complex examples and patterns.

## Related

- [API Reference](../api-reference/README.md)
- [Advanced Guides](../advanced/README.md)
