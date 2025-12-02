// Polyfill localStorage for Node.js environments (required by MSW)
// Node.js 25 has localStorage but it's incomplete - it doesn't have getItem method
// We need to replace it with a proper polyfill before MSW imports
const storage = new Map<string, string>();

// Delete the incomplete implementation if it exists
if (globalThis.localStorage) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
}

// Set up proper localStorage polyfill
globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
        storage.set(key, value);
    },
    removeItem: (key: string) => {
        storage.delete(key);
    },
    clear: () => {
        storage.clear();
    },
    get length() {
        return storage.size;
    },
    key: (index: number) => {
        const keys = Array.from(storage.keys());
        return keys[index] ?? null;
    },
} as Storage;

