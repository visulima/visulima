# YAML Operations

Functions for reading and writing YAML files. Requires the `yaml` peer dependency.

## Installation

YAML operations require the `yaml` package to be installed:

```bash
npm install yaml
```

## readYaml

Asynchronously reads and parses a YAML file.

### Signature

```typescript
function readYaml<T = unknown>(
    path: URL | string,
    options?: ReadYamlOptions<C>
): Promise<T>
```

### Parameters

- `path` (`URL | string`) - Path to the YAML file
- `options` (`ReadYamlOptions`) - Optional reading options
  - Includes all options from `ReadFileOptions` (encoding, compression, etc.)
  - Plus YAML parsing options from the `yaml` library

### Returns

`Promise<T>` - Parsed YAML data

### Examples

```typescript
import { readYaml } from "@visulima/fs/yaml";

// Basic read
const config = await readYaml("./config.yml");
console.log(config);

// With type annotation
interface AppConfig {
    database: {
        host: string;
        port: number;
    };
    features: string[];
}

const config = await readYaml<AppConfig>("./config.yml");

// Read compressed YAML
const data = await readYaml("./data.yml.gz", {
    compression: "gzip",
});

// With custom encoding
const content = await readYaml("./config.yaml", {
    encoding: "utf-16le",
});
```

## readYamlSync

Synchronously reads and parses a YAML file.

### Signature

```typescript
function readYamlSync<T = unknown>(
    path: URL | string,
    options?: ReadYamlOptions<C>
): T
```

### Parameters

Same as `readYaml`.

### Returns

`T` - Parsed YAML data

### Examples

```typescript
import { readYamlSync } from "@visulima/fs/yaml";

const config = readYamlSync("./config.yml");
const typed = readYamlSync<{ name: string }>("./app.yaml");
```

## writeYaml

Asynchronously stringifies and writes a YAML file with automatic directory creation.

### Signature

```typescript
function writeYaml(
    path: URL | string,
    data: unknown,
    options?: WriteYamlOptions
): Promise<void>
```

### Parameters

- `path` (`URL | string`) - Path to the YAML file
- `data` (`unknown`) - Data to stringify and write
- `options` (`WriteYamlOptions`) - Optional writing options
  - `replacer` (`YamlReplacer`) - Replacer function
  - `space` (`number | string`) - Indentation
  - Plus all YAML stringify options from the `yaml` library
  - Plus all `WriteFileOptions`: `encoding`, `mode`, `flag`, `recursive`, `overwrite`, `chown`

### Returns

`Promise<void>`

### Examples

```typescript
import { writeYaml } from "@visulima/fs/yaml";

// Basic write
await writeYaml("./config.yml", {
    database: {
        host: "localhost",
        port: 5432,
    },
    features: ["auth", "api"],
});

// With custom indentation (default is 2)
await writeYaml("./config.yml", data, {
    space: 4,
});

// With replacer function
await writeYaml("./config.yml", data, {
    replacer: (key, value) => {
        // Filter out private properties
        if (key.startsWith("_")) {
            return undefined;
        }
        return value;
    },
});

// With file options
await writeYaml("./config.yml", data, {
    mode: 0o644,
    overwrite: true,
});

// Nested directory creation
await writeYaml("./config/production/app.yml", data);
```

## writeYamlSync

Synchronously stringifies and writes a YAML file.

### Signature

```typescript
function writeYamlSync(
    path: URL | string,
    data: unknown,
    options?: WriteYamlOptions
): void
```

### Parameters

Same as `writeYaml`.

### Returns

`void`

### Examples

```typescript
import { writeYamlSync } from "@visulima/fs/yaml";

writeYamlSync("./config.yml", { name: "App" });
writeYamlSync("./config.yml", data, { space: 4 });
```

## Common Patterns

### Configuration Management

```typescript
import { readYaml, writeYaml } from "@visulima/fs/yaml";

interface DatabaseConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

async function loadDatabaseConfig(): Promise<DatabaseConfig> {
    return await readYaml<DatabaseConfig>("./config/database.yml");
}

async function saveDatabaseConfig(config: DatabaseConfig): Promise<void> {
    await writeYaml("./config/database.yml", config, {
        overwrite: true,
    });
}
```

### Environment-Specific Configuration

```typescript
import { readYaml, writeYaml } from "@visulima/fs/yaml";
import { ensureDir } from "@visulima/fs";

interface Config {
    api: {
        url: string;
        timeout: number;
    };
}

async function loadConfig(env: "development" | "production"): Promise<Config> {
    const path = `./config/${env}.yml`;
    return await readYaml<Config>(path);
}

async function createDefaultConfigs() {
    await ensureDir("./config");
    
    const devConfig: Config = {
        api: {
            url: "http://localhost:3000",
            timeout: 5000,
        },
    };
    
    const prodConfig: Config = {
        api: {
            url: "https://api.production.com",
            timeout: 3000,
        },
    };
    
    await writeYaml("./config/development.yml", devConfig);
    await writeYaml("./config/production.yml", prodConfig);
}
```

### Multi-Document YAML

```typescript
import { readFile, writeFile } from "@visulima/fs";
import { parseAllDocuments, stringify } from "yaml";

// For multi-document YAML files, use the yaml library directly
async function readMultiDocYaml(path: string) {
    const content = await readFile(path);
    const docs = parseAllDocuments(content);
    return docs.map(doc => doc.toJSON());
}

async function writeMultiDocYaml(path: string, documents: unknown[]) {
    const yaml = documents.map(doc => stringify(doc)).join("---\n");
    await writeFile(path, yaml);
}
```

### YAML with Comments

```typescript
import { writeYaml } from "@visulima/fs/yaml";

// YAML naturally supports comments
const configWithComments = `
# Application Configuration
name: MyApp
version: 1.0.0

# Database Settings
database:
  host: localhost  # Use 'localhost' for development
  port: 5432
`;

// When writing, you can include comments in your data structure
await writeYaml("./config.yml", {
    name: "MyApp",
    version: "1.0.0",
    database: {
        host: "localhost",
        port: 5432,
    },
});
```

### Migration from JSON to YAML

```typescript
import { readJson, writeYaml } from "@visulima/fs";

async function migrateJsonToYaml(jsonPath: string, yamlPath: string) {
    const data = await readJson(jsonPath);
    await writeYaml(yamlPath, data);
}

// Usage
await migrateJsonToYaml("./config.json", "./config.yml");
```

## Types

### ReadYamlOptions

```typescript
type ReadYamlOptions<C> = 
    DocumentOptions &
    ParseOptions &
    SchemaOptions &
    ToJSOptions &
    ReadFileOptions<C>;
```

Where `DocumentOptions`, `ParseOptions`, `SchemaOptions`, and `ToJSOptions` come from the `yaml` library.

### WriteYamlOptions

```typescript
type WriteYamlOptions = 
    CreateNodeOptions &
    DocumentOptions &
    ParseOptions &
    SchemaOptions &
    ToStringOptions &
    WriteFileOptions & {
        replacer?: YamlReplacer;
        space?: number | string;
    };

type YamlReplacer = 
    | (number | string)[]
    | ((this: unknown, key: string, value: unknown) => unknown)
    | null;
```

## Error Handling

```typescript
import { readYaml, writeYaml } from "@visulima/fs/yaml";
import { NotFoundError } from "@visulima/fs/error";

async function safeYamlOperation() {
    try {
        const data = await readYaml("./config.yml");
        await writeYaml("./backup.yml", data);
    } catch (error) {
        if (error instanceof NotFoundError) {
            console.error("File not found:", error.path);
        } else if (error.name === "YAMLParseError") {
            console.error("YAML parsing error:", error.message);
        } else {
            console.error("Unexpected error:", error);
        }
    }
}
```

## YAML vs JSON

YAML offers several advantages over JSON:

- Native support for comments
- More readable syntax
- Support for references and anchors
- Multi-line strings without escaping
- No trailing commas issues

```yaml
# YAML example
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret

# JSON equivalent would be:
# {
#   "database": {
#     "host": "localhost",
#     "port": 5432,
#     "credentials": {
#       "username": "admin",
#       "password": "secret"
#     }
#   }
# }
```

## Advanced YAML Features

### Anchors and Aliases

```yaml
default: &defaults
  timeout: 3000
  retries: 3

development:
  <<: *defaults
  debug: true

production:
  <<: *defaults
  debug: false
```

### Multi-line Strings

```yaml
description: |
  This is a multi-line
  string that preserves
  line breaks.

folded: >
  This is a multi-line
  string that folds
  into a single line.
```

## Related

- [JSON Operations](./json-operations.md)
- [File Operations](./file-operations.md)
- [Error Types](./error-types.md)
- [yaml library documentation](https://eemeli.org/yaml/)
