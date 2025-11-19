# Testing Guide for TanStack Query Hooks

This guide provides comprehensive testing strategies for all TanStack Query hooks across React, Solid, Svelte, and Vue frameworks.

## Table of Contents

1. [Testing Setup](#testing-setup)
2. [Testing React Hooks](#testing-react-hooks)
3. [Testing Solid Hooks](#testing-solid-hooks)
4. [Testing Svelte Hooks](#testing-svelte-hooks)
5. [Testing Vue Hooks](#testing-vue-hooks)
6. [Common Testing Patterns](#common-testing-patterns)
7. [Best Practices](#best-practices)

## Testing Setup

### Prerequisites

All frameworks require:

- `vitest` for test runner
- Framework-specific testing utilities
- Mock implementations for `fetch` and `XMLHttpRequest`

### Test Utilities

Each framework has its own test utilities located in `src/{framework}/__tests__/test-utils.ts`:

- **React**: Uses `@testing-library/react` with `renderHook`
- **Solid**: Uses `solid-js` `createRoot` for context
- **Svelte**: Uses Svelte stores with helper functions
- **Vue**: Uses Vue's `mount` with `QueryClientProvider`

## Testing React Hooks

### Example: Testing `useGetFile`

```typescript
import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";

import { useGetFile } from "../use-get-file";
import { renderHookWithQueryClient } from "./test-utils";

describe("useGetFile", () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        globalThis.fetch = vi.fn();
    });

    it("should fetch file successfully", async () => {
        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
            ok: true,
        });

        const { result } = renderHookWithQueryClient(
            () =>
                useGetFile({
                    endpoint: "https://api.example.com",
                    id: "file-123",
                }),
            { queryClient },
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toBe(mockBlob);
    });
});
```

### Key Points for React Testing

1. **Always use `QueryClientProvider`**: Wrap hooks with `renderHookWithQueryClient`
2. **Disable retries**: Set `retry: false` in QueryClient options for faster tests
3. **Use `waitFor`**: Wait for async state changes
4. **Test callbacks**: Use `useEffect` to verify callback invocations

## Testing Solid Hooks

### Example: Testing `createGetFile`

```typescript
import { createSignal } from "solid-js";

import { createGetFile } from "../create-get-file";
import { runInQueryClientRoot } from "./test-utils";

describe("createGetFile", () => {
    it("should fetch file successfully", async () => {
        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
            ok: true,
        });

        const result = runInQueryClientRoot(() => createGetFile({
            endpoint: "https://api.example.com",
            id: "file-123",
        }));

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data()).toBe(mockBlob);
    });

    it("should handle reactive id changes", async () => {
        const [id, setId] = createSignal("file-123");

        const result = runInQueryClientRoot(() => createGetFile({
            endpoint: "https://api.example.com",
            id,
        }));

        // Test initial fetch
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(result.data()).toBeDefined();

        // Change id and verify refetch
        setId("file-456");
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
```

### Key Points for Solid Testing

1. **Use `createRoot`**: All Solid code must run inside a root context
2. **Test reactivity**: Verify that changing signals triggers refetches
3. **Access values**: Use accessor functions `result.data()` to get values

## Testing Svelte Hooks

### Example: Testing `createGetFile`

```typescript
import { writable } from "svelte/store";

import { createGetFile } from "../create-get-file";
import { getStoreValue, waitForStore } from "./test-utils";

describe("createGetFile", () => {
    it("should fetch file successfully", async () => {
        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
            ok: true,
        });

        const result = createGetFile({
            endpoint: "https://api.example.com",
            id: "file-123",
        });

        await waitForStore(result.isLoading, (loading) => loading === false);

        expect(getStoreValue(result.data)).toBe(mockBlob);
    });

    it("should handle reactive store changes", async () => {
        const id = writable("file-123");

        const result = createGetFile({
            endpoint: "https://api.example.com",
            id,
        });

        await waitForStore(result.isLoading, (loading) => loading === false);

        id.set("file-456");

        await waitForStore(result.isLoading, (loading) => loading === false);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
```

### Key Points for Svelte Testing

1. **Use stores**: Pass `writable` or `derived` stores for reactive values
2. **Wait for stores**: Use `waitForStore` helper to wait for state changes
3. **Get values**: Use `getStoreValue` helper to synchronously read store values

## Testing Vue Hooks

### Example: Testing `useGetFile`

```typescript
import { ref } from "vue";

import { useGetFile } from "../use-get-file";
import { withQueryClient } from "./test-utils";

describe("useGetFile", () => {
    it("should fetch file successfully", async () => {
        const mockBlob = new Blob(["test"], { type: "image/jpeg" });

        mockFetch.mockResolvedValueOnce({
            blob: () => Promise.resolve(mockBlob),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
            ok: true,
        });

        const { result } = withQueryClient(() =>
            useGetFile({
                endpoint: "https://api.example.com",
                id: "file-123",
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(result.data.value).toBe(mockBlob);
        expect(result.isLoading.value).toBe(false);
    });

    it("should handle reactive ref changes", async () => {
        const id = ref("file-123");

        const { result } = withQueryClient(() =>
            useGetFile({
                endpoint: "https://api.example.com",
                id,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        id.value = "file-456";

        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
```

### Key Points for Vue Testing

1. **Use `mount`**: Wrap composables in a component with `QueryClientProvider`
2. **Access refs**: Use `.value` to access reactive ref values
3. **Test reactivity**: Change ref values and verify queries refetch

## Common Testing Patterns

### 1. Testing Query Hooks

**What to test:**

- ✅ Successful data fetching
- ✅ Error handling
- ✅ Loading states
- ✅ Reactive parameter changes
- ✅ Enabled/disabled state
- ✅ Callback invocations (React only)
- ✅ Refetch functionality

### 2. Testing Mutation Hooks

**What to test:**

- ✅ Successful mutations
- ✅ Error handling
- ✅ Loading/pending states
- ✅ Progress tracking (for uploads)
- ✅ Query invalidation
- ✅ Reset functionality
- ✅ Optimistic updates (if applicable)

### 3. Mocking Strategies

```typescript
// Mock fetch for queries
const mockFetch = vi.fn();

globalThis.fetch = mockFetch;

mockFetch.mockResolvedValueOnce({
    blob: () => Promise.resolve(new Blob(["test"])),
    headers: new Headers({ "Content-Type": "application/json" }),
    json: () => Promise.resolve({ data: "test" }),
    ok: true,
});

// Mock XMLHttpRequest for uploads with progress
class MockXMLHttpRequest {
    public upload = {
        addEventListener: vi.fn((event, handler) => {
            // Simulate progress
            setTimeout(() => {
                handler({ lengthComputable: true, loaded: 50, total: 100 });
            }, 10);
        }),
    };
    // ... rest of implementation
}
```

### 4. Testing Cache Invalidation

```typescript
it("should invalidate queries on mutation success", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHookWithQueryClient(() => usePutFile({ endpoint: "https://api.example.com" }), { queryClient });

    await result.current.putFile("file-123", file);

    await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: expect.arrayContaining(["storage"]),
        });
    });
});
```

## Best Practices

### 1. Test Isolation

- ✅ Create a new `QueryClient` for each test
- ✅ Clear all mocks between tests
- ✅ Don't share state between tests

### 2. Async Testing

- ✅ Always wait for async operations to complete
- ✅ Use framework-specific waiting utilities (`waitFor`, `waitForStore`, etc.)
- ✅ Set appropriate timeouts

### 3. Mock Management

- ✅ Mock at the right level (fetch, not the hook itself)
- ✅ Reset mocks between tests
- ✅ Use `vi.fn()` for functions that need to be tracked

### 4. Coverage Goals

Aim for 100% coverage of:

- ✅ All hook return values
- ✅ All error paths
- ✅ All conditional logic
- ✅ All callback invocations
- ✅ All reactive behavior

### 5. Framework-Specific Considerations

**React:**

- Test hooks with `renderHook`
- Use `waitFor` for async state
- Test callbacks with `useEffect`

**Solid:**

- Always use `createRoot`
- Test signal reactivity
- Use accessor functions to read values

**Svelte:**

- Test store reactivity
- Use helper functions for store operations
- Verify derived stores update correctly

**Vue:**

- Mount components for composables
- Test ref reactivity
- Use `.value` to access refs

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

## Example Test Files

See the following example test files:

- `src/react/__tests__/use-get-file.test.ts` - React query hook
- `src/react/__tests__/use-put-file.test.ts` - React mutation hook
- `src/solid/__tests__/create-get-file.test.ts` - Solid query hook
- `src/svelte/__tests__/create-get-file.test.ts` - Svelte query hook
- `src/vue/__tests__/use-get-file.test.ts` - Vue query hook
