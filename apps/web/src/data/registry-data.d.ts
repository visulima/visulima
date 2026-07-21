// The registry payload is generated at build time by scripts/generate-registry.js
// (and gitignored — it's a 700 KB+ bundle of every tui-kit component's source,
// derived from packages/terminal/tui-kit). This ambient declaration lets tsc and
// eslint resolve the import before the file has been generated, e.g. on a fresh
// checkout or during `lint:types`. Vite bundles the real JSON at build time.
declare module "@/data/registry-data.json" {
    const data: {
        index: unknown;
        items: Record<string, unknown>;
    };

    export default data;
}
