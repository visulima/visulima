# API Reference

This page documents all functions exported from the main `@visulima/path` module. These functions are compatible with Node.js's path module but with consistent cross-platform behavior.

## Core Functions

### basename()

Returns the last portion of a path, similar to the Unix `basename` command.

**Signature:**

```typescript
basename(path: string, extension?: string): string
```

**Parameters:**

- `path` (string): The file path to evaluate
- `extension` (string, optional): An optional file extension to remove from the result

**Returns:** The last portion of the path

**Examples:**

```javascript
import { basename } from '@visulima/path';

basename('/home/user/documents/file.txt');
// Returns: 'file.txt'

basename('/home/user/documents/file.txt', '.txt');
// Returns: 'file'

basename('C:\\Users\\John\\file.txt');
// Returns: 'file.txt' (Windows path normalized)
```

---

### delimiter

The platform-specific path delimiter used to separate paths in environment variables.

**Type:** `string`

**Value:**
- `;` on Windows
- `:` on POSIX systems

**Example:**

```javascript
import { delimiter } from '@visulima/path';

console.log(process.env.PATH.split(delimiter));
// Splits PATH into individual directories
```

---

### dirname()

Returns the directory name of a path, similar to the Unix `dirname` command.

**Signature:**

```typescript
dirname(path: string): string
```

**Parameters:**

- `path` (string): The file path to evaluate

**Returns:** The directory portion of the path

**Examples:**

```javascript
import { dirname } from '@visulima/path';

dirname('/home/user/documents/file.txt');
// Returns: '/home/user/documents'

dirname('src/components/Button.tsx');
// Returns: 'src/components'

dirname('C:\\Users\\John\\file.txt');
// Returns: 'C:/Users/John' (Windows path normalized)
```

---

### extname()

Returns the extension of the path, from the last occurrence of the `.` character to end of string.

**Signature:**

```typescript
extname(path: string): string
```

**Parameters:**

- `path` (string): The path to evaluate

**Returns:** The extension including the dot, or an empty string if no extension

**Examples:**

```javascript
import { extname } from '@visulima/path';

extname('index.html');
// Returns: '.html'

extname('index.coffee.md');
// Returns: '.md'

extname('index.');
// Returns: '.'

extname('index');
// Returns: ''
```

---

### format()

Returns a path string from an object. This is the opposite of `parse()`.

**Signature:**

```typescript
format(pathObject: {
  root?: string;
  dir?: string;
  base?: string;
  name?: string;
  ext?: string;
}): string
```

**Parameters:**

- `pathObject` (object): An object with path properties
  - `root` (string, optional): The root of the path (e.g., '/')
  - `dir` (string, optional): The directory path
  - `base` (string, optional): The file name with extension
  - `name` (string, optional): The file name without extension
  - `ext` (string, optional): The file extension

**Returns:** A formatted path string

**Priority:**
- `base` takes precedence over `name` + `ext`
- `root` is used if `dir` is not provided

**Examples:**

```javascript
import { format } from '@visulima/path';

format({
  root: '/',
  dir: '/home/user/documents',
  base: 'file.txt'
});
// Returns: '/home/user/documents/file.txt'

format({
  dir: '/home/user/documents',
  name: 'file',
  ext: '.txt'
});
// Returns: '/home/user/documents/file.txt'

format({
  root: '/',
  base: 'file.txt'
});
// Returns: '/file.txt'
```

---

### isAbsolute()

Determines if a path is an absolute path.

**Signature:**

```typescript
isAbsolute(path: string): boolean
```

**Parameters:**

- `path` (string): The path to test

**Returns:** `true` if the path is absolute, `false` otherwise

**Examples:**

```javascript
import { isAbsolute } from '@visulima/path';

isAbsolute('/home/user/file.txt');
// Returns: true

isAbsolute('C:\\Users\\file.txt');
// Returns: true

isAbsolute('./relative/path');
// Returns: false

isAbsolute('relative/path');
// Returns: false
```

---

### join()

Joins all given path segments together using the forward slash as the separator, then normalizes the resulting path.

**Signature:**

```typescript
join(...paths: string[]): string
```

**Parameters:**

- `...paths` (string[]): A sequence of path segments

**Returns:** The joined and normalized path

**Examples:**

```javascript
import { join } from '@visulima/path';

join('home', 'user', 'documents');
// Returns: 'home/user/documents'

join('/home', 'user', '../admin', 'files');
// Returns: '/home/admin/files'

join('foo', '', 'bar', '', 'baz');
// Returns: 'foo/bar/baz' (empty strings ignored)
```

---

### matchesGlob()

Determines if a path matches a glob pattern.

**Signature:**

```typescript
matchesGlob(path: string, pattern: string | string[]): boolean
```

**Parameters:**

- `path` (string): The path to test
- `pattern` (string | string[]): Glob pattern(s) to match against

**Returns:** `true` if the path matches the pattern, `false` otherwise

**Examples:**

```javascript
import { matchesGlob } from '@visulima/path';

matchesGlob('src/index.ts', '**/*.ts');
// Returns: true

matchesGlob('src/index.js', '**/*.ts');
// Returns: false

matchesGlob('test/unit/foo.test.ts', ['**/*.test.ts', '**/*.spec.ts']);
// Returns: true
```

---

### normalize()

Normalizes the given path, resolving `..` and `.` segments.

**Signature:**

```typescript
normalize(path: string): string
```

**Parameters:**

- `path` (string): The path to normalize

**Returns:** The normalized path

**Examples:**

```javascript
import { normalize } from '@visulima/path';

normalize('/home/user/../admin/./files');
// Returns: '/home/admin/files'

normalize('C:\\Users\\John\\..\\Jane\\Documents');
// Returns: 'C:/Users/Jane/Documents'

normalize('foo//bar///baz');
// Returns: 'foo/bar/baz'

normalize('');
// Returns: '.'
```

---

### parse()

Returns an object whose properties represent significant elements of the path.

**Signature:**

```typescript
parse(path: string): {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}
```

**Parameters:**

- `path` (string): The path to parse

**Returns:** An object with path components

**Examples:**

```javascript
import { parse } from '@visulima/path';

parse('/home/user/documents/file.txt');
// Returns:
// {
//   root: '/',
//   dir: '/home/user/documents',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file'
// }

parse('C:\\Users\\file.txt');
// Returns:
// {
//   root: 'C:/',
//   dir: 'C:/Users',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file'
// }

parse('file.txt');
// Returns:
// {
//   root: '',
//   dir: '',
//   base: 'file.txt',
//   ext: '.txt',
//   name: 'file'
// }
```

---

### relative()

Returns the relative path from one path to another.

**Signature:**

```typescript
relative(from: string, to: string): string
```

**Parameters:**

- `from` (string): The source path
- `to` (string): The destination path

**Returns:** The relative path from `from` to `to`

**Examples:**

```javascript
import { relative } from '@visulima/path';

relative('/home/user/projects', '/home/user/documents/file.txt');
// Returns: '../../documents/file.txt'

relative('/home/user/projects/app', '/home/user/projects/app/src');
// Returns: 'src'

relative('/home/user', '/home/user');
// Returns: '' (same path)
```

---

### resolve()

Resolves a sequence of paths or path segments into an absolute path.

**Signature:**

```typescript
resolve(...paths: string[]): string
```

**Parameters:**

- `...paths` (string[]): A sequence of paths or path segments

**Returns:** The resolved absolute path

**Behavior:**
- Processes paths from right to left
- Stops when an absolute path is constructed
- If no absolute path is created, uses the current working directory

**Examples:**

```javascript
import { resolve } from '@visulima/path';

// Assuming current working directory is /home/user
resolve('projects', 'my-app', 'src');
// Returns: '/home/user/projects/my-app/src'

resolve('/home/user', 'projects', 'my-app');
// Returns: '/home/user/projects/my-app'

resolve('foo', '/bar', 'baz');
// Returns: '/bar/baz' (stops at absolute path /bar)

resolve('foo', 'bar', '../baz');
// Returns: '/home/user/foo/baz'
```

---

### sep

The path segment separator. Always `/` regardless of platform.

**Type:** `string`

**Value:** `'/'`

**Example:**

```javascript
import { sep } from '@visulima/path';

const parts = 'home/user/documents'.split(sep);
// Returns: ['home', 'user', 'documents']

const joined = ['home', 'user', 'documents'].join(sep);
// Returns: 'home/user/documents'
```

---

### toNamespacedPath()

On Windows systems, returns the equivalent namespace-prefixed path. On POSIX systems, returns the path unchanged. This is used for normalizing Windows paths.

**Signature:**

```typescript
toNamespacedPath(path: string): string
```

**Parameters:**

- `path` (string): The path to convert

**Returns:** The namespaced path (Windows) or original path (POSIX)

**Examples:**

```javascript
import { toNamespacedPath } from '@visulima/path';

toNamespacedPath('C:\\Users\\file.txt');
// Returns: 'C:/Users/file.txt'

toNamespacedPath('/home/user/file.txt');
// Returns: '/home/user/file.txt'
```

---

## Type Definitions

### Path

The main type interface for the path module, excluding `posix` and `win32` namespaces.

```typescript
type Path = Omit<typeof NodePath, "posix" | "win32">;
```

---

## Module Exports

In addition to individual functions, the module also exports:

### Default Export

```javascript
import path from '@visulima/path';

// All functions available on path object
path.resolve('foo', 'bar');
path.join('foo', 'bar');
// etc.
```

### posix and win32

Both `posix` and `win32` exports are available for compatibility with Node.js path module, but they both reference the same normalized implementation:

```javascript
import { posix, win32 } from '@visulima/path';

// Both behave identically and return normalized POSIX-style paths
posix.join('foo', 'bar'); // Returns: 'foo/bar'
win32.join('foo', 'bar'); // Returns: 'foo/bar'
```

Note: Unlike Node.js path module where `posix` and `win32` behave differently, in `@visulima/path` they both provide consistent POSIX-style behavior.

---

## See Also

- [Utility Functions](./utility-functions.md) - Additional helper functions
- [Examples](./examples.md) - Real-world usage examples
- [Getting Started](./getting-started.md) - Basic usage guide
