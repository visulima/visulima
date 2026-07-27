import { createFileRoute } from "@tanstack/react-router";

import registryData from "@/data/registry-data.json";

// Serves the @visulima/tui-kit shadcn registry so the CLI can fetch items:
//
//   npx shadcn@latest add https://visulima.com/r/gauge.json
//   https://visulima.com/r/registry.json            ← the index
//
// The payloads are bundled at build time by scripts/generate-registry.js, so the
// handler is a pure lookup with no filesystem access at runtime (Netlify SSR).
const { index, items } = registryData;

// Hoisted so it is compiled once, not per request. shadcn requests `<name>.json`;
// the index is `registry.json`.
const JSON_SUFFIX = /\.json$/;

const json = (body: unknown): Response =>
    Response.json(body, {
        headers: {
            "cache-control": "public, max-age=3600, s-maxage=86400",
            "content-type": "application/json; charset=utf-8",
        },
    });

export const Route = createFileRoute("/r/$name")({
    server: {
        handlers: {
            GET({ params }) {
                const name = params.name.replace(JSON_SUFFIX, "");
                const item = name === "registry" ? index : items[name];

                if (!item) {
                    return new Response(`Registry item "${name}" not found`, {
                        headers: { "content-type": "text/plain; charset=utf-8" },
                        status: 404,
                    });
                }

                return json(item);
            },
        },
    },
});
