# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/ono` package.

## Upgrading: Deno runtime removed

Deno is no longer a supported runtime, and ono no longer detects it. Two public values changed:

- `runtime.isDeno` is removed from the page runtime info. Reading it is a type error and `undefined` at runtime.
- `RuntimeName` no longer includes `"deno"`.

### Before

```ts
if (runtime.isDeno) {
    // Deno-specific handling
}
```

### After

Check the global directly if you still need to know whether Deno is present:

```ts
const isDeno = "Deno" in globalThis;
```

A Deno process is no longer reported as `"deno"` by the runtime name. Detection falls through to the remaining checks.
