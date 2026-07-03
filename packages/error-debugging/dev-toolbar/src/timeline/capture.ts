/**
 * Timeline event capture
 * Intercepts HMR events, fetch requests, and JS errors and feeds them
 * into the timeline store so the Timeline app can display them.
 */

import { getTimelineStore } from "./store";

// Survive module hot-reloads / multiple initToolbar() calls
const CAPTURE_KEY = "__visulima_timeline_capture__";

// eslint-disable-next-line sonarjs/pseudo-random
const generateId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const isViteInternalUrl = (url: string): boolean =>
    url.startsWith("/@") || url.includes("/__vite") || url.includes("__visulima-dev-toolbar") || url.startsWith("data:") || url.startsWith("blob:");

const startTimelineCapture = (): void => {
    if ((globalThis as Record<string, unknown>)[CAPTURE_KEY]) {
        return;
    }

    (globalThis as Record<string, unknown>)[CAPTURE_KEY] = true;

    const store = getTimelineStore();

    // ── Vite HMR events ───────────────────────────────────────────────────────
    if (import.meta.hot) {
        // Module-level HMR update (e.g. a component file changed)
        import.meta.hot.on("vite:beforeUpdate", (data: unknown) => {
            const payload = data as { updates?: { path: string }[] };
            const paths = payload.updates?.map((u) => u.path).join(", ") ?? "";

            store.addEvent("hmr", {
                data: { updates: payload.updates },
                id: generateId("hmr"),
                level: "info",
                subtitle: paths || undefined,
                time: Date.now(),
                title: "HMR Update",
            });
        });

        // Full page reload triggered by Vite
        import.meta.hot.on("vite:beforeFullReload", (data: unknown) => {
            const payload = data as { path?: string };

            store.addEvent("hmr", {
                id: generateId("hmr-reload"),
                level: "warning",
                subtitle: payload.path ?? undefined,
                time: Date.now(),
                title: "Full Reload",
            });
        });

        // Vite build error
        import.meta.hot.on("vite:error", (data: unknown) => {
            const payload = data as { err?: { loc?: unknown; message?: string; plugin?: string; stack?: string } };
            const { err } = payload;

            store.addEvent("errors", {
                data: err
                    ? {
                        loc: err.loc,
                        message: err.message,
                        plugin: err.plugin,
                        stack: err.stack,
                    }
                    : undefined,
                id: generateId("vite-err"),
                level: "error",
                subtitle: err?.message ?? "Unknown error",
                time: Date.now(),
                title: "Vite Error",
            });
        });
    }

    // ── Network events (fetch interception) ───────────────────────────────────
    if (globalThis.window !== undefined && typeof globalThis.fetch === "function") {
        const originalFetch: typeof globalThis.fetch = globalThis.fetch.bind(globalThis);

        globalThis.fetch = async (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> => {
            const input = args[0];
            const init = args[1];
            const urlFromUrl = input instanceof URL ? input.href : (input as Request).url;
            const url = typeof input === "string" ? input : urlFromUrl;
            const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

            // Skip Vite-internal and dev-toolbar requests silently
            if (isViteInternalUrl(url)) {
                return originalFetch(...args);
            }

            const start = Date.now();

            try {
                const response = await originalFetch(...args);
                const duration = Date.now() - start;

                store.addEvent("network", {
                    data: { method, status: response.status, statusText: response.statusText, url },
                    duration,
                    id: generateId("net"),
                    level: response.ok ? "info" : "warning",
                    subtitle: `${response.status} ${response.statusText}`,
                    time: start,
                    title: `${method} ${url}`,
                });

                return response;
            } catch (error) {
                const duration = Date.now() - start;
                const message = error instanceof Error ? error.message : "Network error";

                store.addEvent("network", {
                    data: { error: message, method, url },
                    duration,
                    id: generateId("net-err"),
                    level: "error",
                    subtitle: message,
                    time: start,
                    title: `${method} ${url}`,
                });

                throw error;
            }
        };
    }

    // ── JavaScript errors ─────────────────────────────────────────────────────
    if (globalThis.window !== undefined) {
        globalThis.addEventListener("error", (event) => {
            // Ignore errors originating from the dev toolbar itself
            if (event.filename?.includes("visulima-dev-toolbar")) {
                return;
            }

            store.addEvent("errors", {
                data: {
                    colno: event.colno,
                    filename: event.filename,
                    lineno: event.lineno,
                    message: event.message,
                },
                id: generateId("err"),
                level: "error",
                subtitle: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
                time: Date.now(),
                title: event.message || "JavaScript Error",
            });
        });

        globalThis.addEventListener("unhandledrejection", (event) => {
            const { reason } = event;
            const message = reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection");

            store.addEvent("errors", {
                data: { reason: String(reason) },
                id: generateId("rej"),
                level: "error",
                subtitle: message,
                time: Date.now(),
                title: "Unhandled Promise Rejection",
            });
        });
    }
};

export { startTimelineCapture };
