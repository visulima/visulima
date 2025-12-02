import { getVitestConfig } from "../../tools/get-vitest-config";

// Polyfill localStorage BEFORE any modules are imported
// This must run at config load time, before MSW imports
// Node.js 25 has localStorage but it's incomplete - it doesn't have getItem method
const storage = new Map<string, string>();

if (globalThis.localStorage) {
    delete (globalThis as { localStorage?: unknown }).localStorage;
}

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

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
    },
});

export default config;
