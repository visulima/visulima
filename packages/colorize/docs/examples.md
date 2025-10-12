# Examples

Practical examples demonstrating real-world usage of `@visulima/colorize`.

## Table of Contents

- [CLI Applications](#cli-applications)
- [Logging Systems](#logging-systems)
- [Build Tools](#build-tools)
- [Testing Output](#testing-output)
- [Progress Indicators](#progress-indicators)
- [Error Handling](#error-handling)
- [Formatted Output](#formatted-output)
- [Interactive Prompts](#interactive-prompts)

## CLI Applications

### Help Command

Create a colorful help menu for your CLI:

```typescript
import { bold, cyan, yellow, green, gray } from '@visulima/colorize';

function showHelp() {
  console.log();
  console.log(bold(cyan('my-cli')) + gray(' v1.0.0'));
  console.log();
  console.log(bold('USAGE'));
  console.log('  $ my-cli [COMMAND] [OPTIONS]');
  console.log();
  console.log(bold('COMMANDS'));
  console.log(`  ${green('init')}      Initialize a new project`);
  console.log(`  ${green('build')}     Build the project`);
  console.log(`  ${green('dev')}       Start development server`);
  console.log(`  ${green('test')}      Run tests`);
  console.log(`  ${green('deploy')}    Deploy to production`);
  console.log();
  console.log(bold('OPTIONS'));
  console.log(`  ${yellow('-h, --help')}     Show this help message`);
  console.log(`  ${yellow('-v, --version')}  Show version number`);
  console.log(`  ${yellow('--verbose')}      Enable verbose logging`);
  console.log(`  ${yellow('--quiet')}        Suppress all output`);
  console.log();
  console.log(bold('EXAMPLES'));
  console.log(`  $ my-cli init ${gray('# Initialize new project')}`);
  console.log(`  $ my-cli build --verbose ${gray('# Build with logs')}`);
  console.log(`  $ my-cli deploy --env=prod ${gray('# Deploy to production')}`);
  console.log();
}

showHelp();
```

### Command Execution

Show command execution status:

```typescript
import { bold, green, red, yellow, blue } from '@visulima/colorize';

function executeCommand(command: string) {
  console.log(blue(`→`), `Executing ${bold(command)}...`);
  
  try {
    // Simulate command execution
    const success = Math.random() > 0.3;
    
    if (success) {
      console.log(green('✓'), `${command} completed successfully`);
    } else {
      console.log(red('✗'), `${command} failed`);
    }
  } catch (error) {
    console.log(red('✗'), `Error executing ${command}:`);
    console.log(red(`  ${error.message}`));
  }
}

executeCommand('npm install');
executeCommand('npm run build');
executeCommand('npm run test');
```

### Version Information

Display version and environment info:

```typescript
import { bold, cyan, gray, green } from '@visulima/colorize';

function showVersion() {
  console.log();
  console.log(bold(cyan('my-cli')), gray('version'), green('1.0.0'));
  console.log();
  console.log(bold('Environment:'));
  console.log(`  Node:    ${green(process.version)}`);
  console.log(`  OS:      ${green(process.platform)}`);
  console.log(`  Arch:    ${green(process.arch)}`);
  console.log();
}

showVersion();
```

## Logging Systems

### Log Levels

Implement a comprehensive logging system:

```typescript
import { red, yellow, blue, green, gray, bold } from '@visulima/colorize';

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  error(message: string, ...args: any[]) {
    console.error(
      gray(`[${this.formatTimestamp()}]`),
      red(bold('[ERROR]')),
      message,
      ...args
    );
  }

  warn(message: string, ...args: any[]) {
    console.warn(
      gray(`[${this.formatTimestamp()}]`),
      yellow(bold('[WARN]')),
      message,
      ...args
    );
  }

  info(message: string, ...args: any[]) {
    console.info(
      gray(`[${this.formatTimestamp()}]`),
      blue(bold('[INFO]')),
      message,
      ...args
    );
  }

  success(message: string, ...args: any[]) {
    console.log(
      gray(`[${this.formatTimestamp()}]`),
      green(bold('[SUCCESS]')),
      message,
      ...args
    );
  }

  debug(message: string, ...args: any[]) {
    console.debug(
      gray(`[${this.formatTimestamp()}]`),
      gray('[DEBUG]'),
      gray(message),
      ...args
    );
  }
}

const logger = new Logger();

logger.info('Application starting...');
logger.success('Configuration loaded');
logger.warn('Using deprecated API');
logger.error('Connection failed');
logger.debug('Request data:', { id: 1, name: 'test' });
```

### Structured Logging

Create structured, colorized log output:

```typescript
import { bold, cyan, green, red, yellow, gray } from '@visulima/colorize';

interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  data?: Record<string, any>;
}

function formatLogEntry(entry: LogEntry): void {
  const colors = {
    info: cyan,
    error: red,
    warn: yellow,
    success: green,
  };

  const color = colors[entry.level];
  const timestamp = gray(new Date().toISOString());
  const level = bold(color(`[${entry.level.toUpperCase()}]`));

  console.log(`${timestamp} ${level} ${entry.message}`);

  if (entry.data) {
    Object.entries(entry.data).forEach(([key, value]) => {
      console.log(`  ${gray(key + ':')} ${value}`);
    });
  }
}

formatLogEntry({
  level: 'info',
  message: 'Server started',
  data: { port: 3000, host: 'localhost' },
});

formatLogEntry({
  level: 'error',
  message: 'Database connection failed',
  data: { host: 'db.example.com', error: 'ECONNREFUSED' },
});
```

## Build Tools

### Build Progress

Display build progress with colors:

```typescript
import { bold, green, blue, yellow, cyan, gray } from '@visulima/colorize';

function buildProject() {
  console.log(bold(blue('Building project...')));
  console.log();

  const steps = [
    { name: 'Cleaning output directory', duration: 100 },
    { name: 'Compiling TypeScript', duration: 2000 },
    { name: 'Bundling assets', duration: 1500 },
    { name: 'Optimizing images', duration: 800 },
    { name: 'Generating source maps', duration: 500 },
    { name: 'Creating production build', duration: 1000 },
  ];

  let completed = 0;

  steps.forEach((step, index) => {
    setTimeout(() => {
      completed++;
      const percent = Math.round((completed / steps.length) * 100);
      
      console.log(
        green('✓'),
        cyan(`[${completed}/${steps.length}]`),
        step.name,
        gray(`(${step.duration}ms)`)
      );

      if (completed === steps.length) {
        console.log();
        console.log(bold(green('✓ Build completed successfully!')));
        console.log(gray(`Total time: ${steps.reduce((a, s) => a + s.duration, 0)}ms`));
      }
    }, index * 200);
  });
}

buildProject();
```

### Bundle Analysis

Display bundle size information:

```typescript
import { bold, cyan, green, yellow, red, gray } from '@visulima/colorize';

interface Bundle {
  name: string;
  size: number;
  gzip: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getSizeColor(size: number) {
  if (size < 50000) return green;
  if (size < 150000) return yellow;
  return red;
}

function showBundleAnalysis(bundles: Bundle[]) {
  console.log(bold('Bundle Analysis:'));
  console.log();

  bundles.forEach(bundle => {
    const sizeColor = getSizeColor(bundle.size);
    const size = formatSize(bundle.size);
    const gzip = formatSize(bundle.gzip);

    console.log(
      cyan(bundle.name.padEnd(30)),
      sizeColor(size.padEnd(12)),
      gray(`(${gzip} gzip)`)
    );
  });

  const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
  const totalGzip = bundles.reduce((sum, b) => sum + b.gzip, 0);

  console.log();
  console.log(
    bold('Total:'.padEnd(30)),
    bold(formatSize(totalSize).padEnd(12)),
    gray(`(${formatSize(totalGzip)} gzip)`)
  );
}

showBundleAnalysis([
  { name: 'main.js', size: 145000, gzip: 48000 },
  { name: 'vendor.js', size: 380000, gzip: 125000 },
  { name: 'styles.css', size: 32000, gzip: 8500 },
]);
```

## Testing Output

### Test Results

Display test results with colors:

```typescript
import { bold, green, red, yellow, cyan, gray } from '@visulima/colorize';

interface TestResult {
  suite: string;
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

function displayTestResults(results: TestResult[]) {
  const suites = new Map<string, TestResult[]>();

  results.forEach(result => {
    if (!suites.has(result.suite)) {
      suites.set(result.suite, []);
    }
    suites.get(result.suite)!.push(result);
  });

  suites.forEach((tests, suite) => {
    console.log();
    console.log(bold(cyan(suite)));

    tests.forEach(test => {
      let icon: string;
      let color: (text: string) => string;

      switch (test.status) {
        case 'pass':
          icon = '✓';
          color = green;
          break;
        case 'fail':
          icon = '✗';
          color = red;
          break;
        case 'skip':
          icon = '○';
          color = yellow;
          break;
      }

      console.log(
        color(`  ${icon}`),
        test.name,
        gray(`(${test.duration}ms)`)
      );

      if (test.error) {
        console.log(red(`    ${test.error}`));
      }
    });
  });

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const total = results.length;
  const duration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log();
  console.log(bold('Test Summary:'));
  console.log(`  ${green(`${passed} passed`)}`);
  if (failed > 0) console.log(`  ${red(`${failed} failed`)}`);
  if (skipped > 0) console.log(`  ${yellow(`${skipped} skipped`)}`);
  console.log(`  ${cyan(`${total} total`)}`);
  console.log(`  ${gray(`Time: ${duration}ms`)}`);
}

displayTestResults([
  { suite: 'Authentication', name: 'should login user', status: 'pass', duration: 45 },
  { suite: 'Authentication', name: 'should reject invalid password', status: 'pass', duration: 23 },
  { suite: 'API', name: 'should fetch users', status: 'pass', duration: 156 },
  { suite: 'API', name: 'should handle errors', status: 'fail', duration: 89, error: 'Expected 404, received 500' },
  { suite: 'Utils', name: 'should format dates', status: 'skip', duration: 0 },
]);
```

### Coverage Report

Display code coverage with colors:

```typescript
import { bold, green, yellow, red, cyan } from '@visulima/colorize';

interface Coverage {
  file: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

function getCoverageColor(percent: number) {
  if (percent >= 80) return green;
  if (percent >= 50) return yellow;
  return red;
}

function displayCoverage(coverage: Coverage[]) {
  console.log(bold('Code Coverage:'));
  console.log();
  console.log(
    cyan('File'.padEnd(40)),
    'Stmts'.padEnd(8),
    'Branch'.padEnd(8),
    'Funcs'.padEnd(8),
    'Lines'
  );
  console.log('-'.repeat(72));

  coverage.forEach(item => {
    const stmts = getCoverageColor(item.statements)(`${item.statements}%`);
    const branch = getCoverageColor(item.branches)(`${item.branches}%`);
    const funcs = getCoverageColor(item.functions)(`${item.functions}%`);
    const lines = getCoverageColor(item.lines)(`${item.lines}%`);

    console.log(
      item.file.padEnd(40),
      stmts.padEnd(8),
      branch.padEnd(8),
      funcs.padEnd(8),
      lines
    );
  });
}

displayCoverage([
  { file: 'src/auth.ts', statements: 95, branches: 87, functions: 100, lines: 94 },
  { file: 'src/api.ts', statements: 78, branches: 65, functions: 82, lines: 76 },
  { file: 'src/utils.ts', statements: 45, branches: 38, functions: 50, lines: 43 },
]);
```

## Progress Indicators

### Progress Bar

Create an animated progress bar:

```typescript
import { green, gray, yellow, bold } from '@visulima/colorize';

function createProgressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((width * current) / total);
  const empty = width - filled;

  const bar = green('█'.repeat(filled)) + gray('░'.repeat(empty));
  const status = percentage === 100 ? green(bold('DONE')) : yellow(bold(`${percentage}%`));

  return `[${bar}] ${status}`;
}

function simulateProgress() {
  let current = 0;
  const total = 100;

  const interval = setInterval(() => {
    console.clear();
    console.log(bold('Downloading...'));
    console.log(createProgressBar(current, total));
    console.log(gray(`${current}/${total} items`));

    current += 5;

    if (current > total) {
      clearInterval(interval);
      console.clear();
      console.log(green(bold('✓ Download complete!')));
    }
  }, 200);
}

// simulateProgress();
```

### Spinner

Create a loading spinner:

```typescript
import { cyan, green, bold } from '@visulima/colorize';

function createSpinner(message: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  const interval = setInterval(() => {
    const frame = frames[i = ++i % frames.length];
    process.stdout.write(`\r${cyan(frame)} ${message}`);
  }, 80);

  return {
    stop: (finalMessage?: string) => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      if (finalMessage) {
        console.log(green(bold('✓')), finalMessage);
      }
    },
  };
}

// Example usage:
// const spinner = createSpinner('Loading data...');
// setTimeout(() => spinner.stop('Data loaded successfully!'), 3000);
```

## Error Handling

### Detailed Error Display

Show detailed error information:

```typescript
import { red, yellow, gray, bold, underline } from '@visulima/colorize';

function displayError(error: Error) {
  console.log();
  console.log(red(bold('ERROR:')), error.message);
  console.log();

  if (error.stack) {
    console.log(yellow('Stack Trace:'));
    const stackLines = error.stack.split('\n').slice(1);
    stackLines.forEach(line => {
      console.log(gray('  ' + line.trim()));
    });
  }

  console.log();
  console.log(yellow('Need help?'));
  console.log(`  Visit: ${underline('https://docs.example.com/errors')}`);
  console.log(`  Or run: ${bold('my-cli help')}`);
}

try {
  throw new Error('Failed to connect to database');
} catch (error) {
  displayError(error as Error);
}
```

### Validation Errors

Display validation errors clearly:

```typescript
import { red, yellow, cyan, bold } from '@visulima/colorize';

interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

function displayValidationErrors(errors: ValidationError[]) {
  console.log();
  console.log(red(bold(`Found ${errors.length} validation error(s):`)));
  console.log();

  errors.forEach((error, index) => {
    console.log(red(`  ${index + 1}.`), cyan(error.field), '-', error.message);
    if (error.value !== undefined) {
      console.log(yellow(`     Received: ${JSON.stringify(error.value)}`));
    }
  });

  console.log();
}

displayValidationErrors([
  { field: 'email', message: 'Invalid email format', value: 'not-an-email' },
  { field: 'age', message: 'Must be a number', value: 'abc' },
  { field: 'password', message: 'Too short (minimum 8 characters)' },
]);
```

## Formatted Output

### Tables

Create colorful tables:

```typescript
import { bold, cyan, green, gray } from '@visulima/colorize';

interface TableRow {
  [key: string]: string | number;
}

function displayTable(headers: string[], rows: TableRow[]) {
  const columnWidths = headers.map((header, i) => {
    const key = Object.keys(rows[0])[i];
    const maxValueLength = Math.max(
      ...rows.map(row => String(row[key]).length)
    );
    return Math.max(header.length, maxValueLength) + 2;
  });

  // Header
  console.log(
    headers.map((header, i) =>
      bold(cyan(header.padEnd(columnWidths[i])))
    ).join('')
  );

  console.log(gray('─'.repeat(columnWidths.reduce((a, b) => a + b, 0))));

  // Rows
  rows.forEach(row => {
    console.log(
      Object.values(row).map((value, i) =>
        String(value).padEnd(columnWidths[i])
      ).join('')
    );
  });
}

displayTable(
  ['Name', 'Status', 'Time'],
  [
    { name: 'Build', status: green('✓ Pass'), time: '1.2s' },
    { name: 'Test', status: green('✓ Pass'), time: '3.5s' },
    { name: 'Deploy', status: green('✓ Pass'), time: '45s' },
  ]
);
```

### Tree Structure

Display hierarchical data:

```typescript
import { cyan, gray, bold } from '@visulima/colorize';

interface TreeNode {
  name: string;
  children?: TreeNode[];
}

function displayTree(node: TreeNode, prefix: string = '', isLast: boolean = true) {
  const connector = isLast ? '└── ' : '├── ';
  console.log(prefix + gray(connector) + cyan(node.name));

  if (node.children) {
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      displayTree(child, newPrefix, isLastChild);
    });
  }
}

const fileTree: TreeNode = {
  name: 'project/',
  children: [
    {
      name: 'src/',
      children: [
        { name: 'index.ts' },
        { name: 'utils.ts' },
      ],
    },
    {
      name: 'tests/',
      children: [
        { name: 'unit.test.ts' },
      ],
    },
    { name: 'package.json' },
    { name: 'tsconfig.json' },
  ],
};

console.log(bold('Project Structure:'));
console.log();
displayTree(fileTree);
```

## Interactive Prompts

### Confirmation Prompt

Create a colorful confirmation:

```typescript
import { yellow, green, red, bold } from '@visulima/colorize';

function confirm(message: string): void {
  console.log(yellow(bold('?')), message, gray('(y/n)'));
  // In real application, you would read user input
}

confirm('Do you want to continue?');
confirm('Delete all files?');
```

### Selection Menu

Display a selection menu:

```typescript
import { cyan, yellow, gray, bold } from '@visulima/colorize';

interface MenuItem {
  label: string;
  value: string;
}

function displayMenu(title: string, items: MenuItem[], selected: number = 0) {
  console.log(bold(cyan(title)));
  console.log();

  items.forEach((item, index) => {
    const prefix = index === selected ? yellow('❯') : ' ';
    const label = index === selected ? cyan(item.label) : gray(item.label);
    console.log(`${prefix} ${label}`);
  });
}

displayMenu(
  'Select an option:',
  [
    { label: 'Create new project', value: 'create' },
    { label: 'Open existing project', value: 'open' },
    { label: 'Settings', value: 'settings' },
    { label: 'Exit', value: 'exit' },
  ],
  1
);
```

## More Examples

For more advanced examples, see:
- [Advanced Features](./advanced.md) - Gradients and templates
- [Browser Usage](./browser.md) - Browser-specific examples
- [API Reference](./api-reference.md) - Complete API documentation
