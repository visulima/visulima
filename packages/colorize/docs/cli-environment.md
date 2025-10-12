# Environment Variables & CLI Arguments

Guide to configuring Colorize behavior through environment variables and command-line arguments.

## Table of Contents

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Command-Line Arguments](#command-line-arguments)
- [Color Support Detection](#color-support-detection)
- [Force/Disable Colors](#forcedisable-colors)
- [CI/CD Environments](#cicd-environments)
- [Configuration Priority](#configuration-priority)

## Overview

Colorize automatically detects terminal capabilities and respects standard environment variables and CLI flags for controlling color output.

**Key Features:**
- Automatic color support detection
- Standard environment variable support
- CLI flag support
- CI/CD environment detection
- Configurable fallback behavior

## Environment Variables

### NO_COLOR

Disables all color output when set to any value.

```bash
# Disable colors
NO_COLOR=1 node app.js
NO_COLOR=true node app.js
NO_COLOR=yes node app.js

# Any value disables colors
NO_COLOR= node app.js
```

**Standard:** [no-color.org](https://no-color.org/)

**Usage in Code:**
```typescript
import { red } from '@visulima/colorize';

// Automatically respects NO_COLOR
console.log(red('Text')); // Will be plain if NO_COLOR is set
```

### FORCE_COLOR

Forces color output regardless of terminal capabilities.

```bash
# Force colors
FORCE_COLOR=1 node app.js
FORCE_COLOR=true node app.js

# Force specific color level
FORCE_COLOR=1 node app.js  # 16 colors
FORCE_COLOR=2 node app.js  # 256 colors
FORCE_COLOR=3 node app.js  # TrueColor (16 million)
```

**Levels:**
- `1`: Basic 16 colors
- `2`: 256 colors
- `3`: TrueColor (16 million colors)

**Usage:**
```bash
# Force TrueColor in CI
FORCE_COLOR=3 npm test
```

### TERM

Terminal type indicator. Colorize uses this to detect color capabilities.

```bash
# Common values
TERM=xterm-256color  # 256 color support
TERM=xterm           # 16 color support
TERM=dumb            # No color support
```

**Automatic Detection:**
```typescript
// Colorize automatically checks TERM
import { red } from '@visulima/colorize';

// Will use appropriate color depth based on TERM
console.log(red('Text'));
```

### COLORTERM

Indicates truecolor support.

```bash
# TrueColor support
COLORTERM=truecolor node app.js
COLORTERM=24bit node app.js
```

**Common Values:**
- `truecolor`: 24-bit color support
- `24bit`: Same as truecolor

### NODE_DISABLE_COLORS

Node.js-specific variable to disable colors.

```bash
NODE_DISABLE_COLORS=1 node app.js
```

**Note:** Equivalent to `NO_COLOR` but specific to Node.js.

## Command-Line Arguments

### --no-color

Disables color output via CLI flag.

```bash
node app.js --no-color
npm test -- --no-color
```

**Usage:**
```typescript
// Colorize automatically detects --no-color flag
import { red } from '@visulima/colorize';

console.log(red('Text')); // Plain if --no-color is passed
```

### --color

Forces color output via CLI flag.

```bash
node app.js --color
npm test -- --color

# With color level
node app.js --color=256
node app.js --color=16m  # 16 million (TrueColor)
```

**Color Levels:**
- `--color`: Auto-detect best level
- `--color=16`: 16 colors
- `--color=256`: 256 colors
- `--color=16m`: TrueColor

## Color Support Detection

Colorize automatically detects color support through multiple checks:

### Detection Process

1. Check `NO_COLOR` environment variable
2. Check `FORCE_COLOR` environment variable
3. Check CLI flags (`--no-color`, `--color`)
4. Check if output is TTY
5. Check `TERM` environment variable
6. Check `COLORTERM` for TrueColor
7. Check CI environment variables
8. Fall back to safe default

### Manual Detection

```typescript
// Colorize handles this automatically
import { red } from '@visulima/colorize';

// Will automatically use appropriate color depth
console.log(red('Text'));
```

### TTY Detection

Colorize checks if output is a TTY:

```bash
# Colors enabled (TTY)
node app.js

# Colors disabled (not TTY)
node app.js > output.txt
node app.js | less
```

### Terminal Support

**Supported Terminals:**
- iTerm2 (TrueColor)
- Terminal.app (TrueColor on macOS 10.12+)
- Hyper (TrueColor)
- Windows Terminal (TrueColor)
- VSCode integrated terminal (TrueColor)
- GNOME Terminal (TrueColor)
- Konsole (TrueColor)
- Most modern terminals

## Force/Disable Colors

### Forcing Colors

Use when piping output but still want colors:

```bash
# Force colors when piping
FORCE_COLOR=1 node app.js | less -R

# Force colors in Docker
docker run -e FORCE_COLOR=3 myimage

# Force colors in CI
CI=true FORCE_COLOR=3 npm test
```

**Use Cases:**
- CI/CD with color support
- Docker containers
- Piping to color-aware tools
- SSH sessions

### Disabling Colors

Use when colors interfere with output:

```bash
# Disable for file output
NO_COLOR=1 node app.js > output.log

# Disable for parsing
NO_COLOR=1 node app.js | grep "pattern"

# Disable in production
NODE_ENV=production NO_COLOR=1 node app.js
```

**Use Cases:**
- File logging
- Text processing
- Production deployments
- Legacy systems

## CI/CD Environments

### Automatic CI Detection

Colorize detects common CI environments:

**Detected CIs:**
- GitHub Actions
- GitLab CI
- Travis CI
- CircleCI
- Jenkins
- Azure Pipelines
- Bitbucket Pipelines
- AppVeyor
- And many more...

### CI Environment Variables

```bash
# GitHub Actions
GITHUB_ACTIONS=true FORCE_COLOR=3

# GitLab CI
GITLAB_CI=true FORCE_COLOR=3

# Travis CI
TRAVIS=true FORCE_COLOR=3

# CircleCI
CIRCLECI=true FORCE_COLOR=3

# Jenkins
JENKINS_HOME=/var/jenkins FORCE_COLOR=3
```

### Enabling Colors in CI

**GitHub Actions:**
```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
        env:
          FORCE_COLOR: 3
```

**GitLab CI:**
```yaml
# .gitlab-ci.yml
test:
  script:
    - npm test
  variables:
    FORCE_COLOR: "3"
```

**Travis CI:**
```yaml
# .travis.yml
env:
  global:
    - FORCE_COLOR=3
```

**CircleCI:**
```yaml
# .circleci/config.yml
jobs:
  test:
    docker:
      - image: node:18
    environment:
      FORCE_COLOR: 3
    steps:
      - checkout
      - run: npm test
```

### Docker

```dockerfile
# Dockerfile
FROM node:18

# Enable colors
ENV FORCE_COLOR=3

COPY . .
RUN npm install

CMD ["node", "app.js"]
```

Or when running:
```bash
docker run -e FORCE_COLOR=3 myimage
```

## Configuration Priority

Order of precedence (highest to lowest):

1. `NO_COLOR` environment variable (always disables)
2. `--no-color` CLI flag
3. `FORCE_COLOR` environment variable
4. `--color` CLI flag
5. Automatic detection (TTY, TERM, etc.)

**Examples:**

```bash
# NO_COLOR takes precedence
FORCE_COLOR=3 NO_COLOR=1 node app.js
# Result: No colors

# CLI flag overrides environment
FORCE_COLOR=0 node app.js --color
# Result: Colors enabled

# --no-color overrides FORCE_COLOR
FORCE_COLOR=3 node app.js --no-color
# Result: No colors
```

## Practical Examples

### Development vs Production

```bash
# Development (colors enabled)
npm run dev

# Production (colors disabled for logs)
NODE_ENV=production NO_COLOR=1 npm start > app.log
```

### Testing

```bash
# Local testing (colors)
npm test

# CI testing (colors)
FORCE_COLOR=3 npm test

# Headless testing (no colors)
NO_COLOR=1 npm test
```

### Logging

```bash
# Console logging (colors)
node app.js

# File logging (no colors)
NO_COLOR=1 node app.js > app.log 2>&1

# Both (colors to console, plain to file)
node app.js 2>&1 | tee >(NO_COLOR=1 cat > app.log)
```

### SSH Sessions

```bash
# Enable colors over SSH
ssh user@server "FORCE_COLOR=1 node app.js"

# Disable colors over SSH
ssh user@server "NO_COLOR=1 node app.js"
```

## Programmatic Configuration

While not recommended (respect user preferences), you can configure programmatically:

```typescript
// Set before importing Colorize
process.env.FORCE_COLOR = '3';
process.env.NO_COLOR = '1';

import { red } from '@visulima/colorize';
```

**Warning:** Always prefer environment variables and CLI flags over programmatic configuration.

## Troubleshooting

### Colors Not Working

```bash
# Check if TTY
node -p "process.stdout.isTTY"

# Check TERM
echo $TERM

# Check environment
env | grep -i color

# Force colors
FORCE_COLOR=3 node app.js
```

### Colors in Wrong Depth

```bash
# Check detected level
TERM=xterm node app.js  # 16 colors
TERM=xterm-256color node app.js  # 256 colors
COLORTERM=truecolor node app.js  # TrueColor
```

### Colors Showing in Logs

```bash
# Disable for file output
NO_COLOR=1 node app.js > output.log

# Strip colors in code
import { strip } from '@visulima/colorize';
```

## Best Practices

### Respect User Preferences

Always respect `NO_COLOR`:

```typescript
// Good - automatically respects NO_COLOR
import { red } from '@visulima/colorize';
console.log(red('Text'));

// Bad - forcing colors
process.env.FORCE_COLOR = '3';
```

### Provide CLI Options

Offer both flags:

```typescript
#!/usr/bin/env node

const args = process.argv.slice(2);
const noColor = args.includes('--no-color');
const forceColor = args.includes('--color');

if (noColor) process.env.NO_COLOR = '1';
if (forceColor) process.env.FORCE_COLOR = '3';

import { red } from '@visulima/colorize';
```

### Document Behavior

Document color behavior in your README:

```markdown
## Colors

This tool supports colored output by default. You can control this behavior:

- Disable colors: `--no-color` or `NO_COLOR=1`
- Force colors: `--color` or `FORCE_COLOR=1`
```

## Related

- [Getting Started](./getting-started.md) - Basic usage
- [Installation](./installation.md) - Setup guide
- [Troubleshooting](./troubleshooting.md) - Common issues
- [FAQ](./faq.md) - Frequently asked questions
