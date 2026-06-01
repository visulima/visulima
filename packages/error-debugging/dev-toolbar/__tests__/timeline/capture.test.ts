// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startTimelineCapture } from "../../src/timeline/capture";
import { getTimelineStore } from "../../src/timeline/store";

const CAPTURE_KEY = "__visulima_timeline_capture__";

describe("timeline/capture", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        // Reset the once-only capture guard so each test installs fresh hooks.
        delete (globalThis as Record<string, unknown>)[CAPTURE_KEY];
        getTimelineStore().clearAll();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        delete (globalThis as Record<string, unknown>)[CAPTURE_KEY];
        getTimelineStore().clearAll();
        vi.restoreAllMocks();
    });

    describe(startTimelineCapture, () => {
        it("is idempotent — a second call leaves the guard set and does not re-wrap fetch", () => {
            expect.assertions(2);

            startTimelineCapture();

            const wrappedFetch = globalThis.fetch;

            startTimelineCapture();

            expect((globalThis as Record<string, unknown>)[CAPTURE_KEY]).toBe(true);
            // The second call returns early, so fetch is not wrapped again.
            expect(globalThis.fetch).toBe(wrappedFetch);
        });

        it("records a successful fetch as a network event", async () => {
            expect.assertions(3);

            vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("ok", { status: 200, statusText: "OK" }));

            startTimelineCapture();

            await globalThis.fetch("/api/data");

            const events = getTimelineStore().getGroupEvents("network");

            expect(events).toHaveLength(1);
            expect(events[0]?.level).toBe("info");
            expect(events[0]?.title).toBe("GET /api/data");
        });

        it("marks a non-ok response as a warning", async () => {
            expect.assertions(2);

            vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("nope", { status: 404, statusText: "Not Found" }));

            startTimelineCapture();

            await globalThis.fetch("/missing", { method: "post" });

            const events = getTimelineStore().getGroupEvents("network");

            expect(events[0]?.level).toBe("warning");
            // Method is uppercased.
            expect(events[0]?.title).toBe("POST /missing");
        });

        it("records a failed fetch as an error event and rethrows", async () => {
            expect.assertions(3);

            vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
                throw new Error("connection refused");
            });

            startTimelineCapture();

            await expect(globalThis.fetch("/boom")).rejects.toThrow("connection refused");

            const events = getTimelineStore().getGroupEvents("network");

            expect(events[0]?.level).toBe("error");
            expect(events[0]?.subtitle).toBe("connection refused");
        });

        it("derives the url from a URL instance and the method from a Request", async () => {
            expect.assertions(2);

            vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("ok", { status: 200, statusText: "OK" }));

            startTimelineCapture();

            await globalThis.fetch(new URL("http://localhost/from-url"));
            await globalThis.fetch(new Request("http://localhost/from-request", { method: "DELETE" }));

            const events = getTimelineStore().getGroupEvents("network");

            expect(events.some((event) => event.data && (event.data as { url?: string }).url === "http://localhost/from-url")).toBe(true);
            expect(events.some((event) => event.title === "DELETE http://localhost/from-request")).toBe(true);
        });

        it("skips Vite-internal and dev-toolbar requests silently", async () => {
            expect.assertions(1);

            vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("ok", { status: 200, statusText: "OK" }));

            startTimelineCapture();

            await globalThis.fetch("/@vite/client");
            await globalThis.fetch("/__visulima-dev-toolbar/options");
            await globalThis.fetch("data:text/plain,hi");
            await globalThis.fetch("blob:http://localhost/abc");

            expect(getTimelineStore().getGroupEvents("network")).toHaveLength(0);
        });

        // NOTE: window "error"/"unhandledrejection" listeners are attached to the
        // global object and cannot be removed by the capture module, so they
        // accumulate across tests. We therefore assert on recorded CONTENT rather
        // than exact event counts.
        it("captures a window error event (ignoring dev-toolbar's own files)", () => {
            expect.assertions(2);

            startTimelineCapture();

            // dev-toolbar's own file is ignored — produces no event with that filename.
            globalThis.dispatchEvent(new ErrorEvent("error", { colno: 1, filename: "/x/visulima-dev-toolbar/overlay.js", lineno: 2, message: "internal" }));

            const internal = getTimelineStore()
                .getGroupEvents("errors")
                .find((event) => (event.data as { filename?: string } | undefined)?.filename === "/x/visulima-dev-toolbar/overlay.js");

            expect(internal).toBeUndefined();

            // A real app error is recorded.
            globalThis.dispatchEvent(new ErrorEvent("error", { colno: 5, filename: "/app/main.ts", lineno: 10, message: "Boom" }));

            const recorded = getTimelineStore()
                .getGroupEvents("errors")
                .find((event) => event.subtitle === "/app/main.ts:10:5");

            expect(recorded).toBeDefined();
        });

        it("captures an unhandled promise rejection with an Error reason", () => {
            expect.assertions(1);

            startTimelineCapture();

            const event = new Event("unhandledrejection") as PromiseRejectionEvent;

            Object.defineProperty(event, "reason", { value: new Error("rejected!"), writable: false });

            globalThis.dispatchEvent(event);

            const recorded = getTimelineStore()
                .getGroupEvents("errors")
                .find((stored) => stored.title === "Unhandled Promise Rejection" && stored.subtitle === "rejected!");

            expect(recorded).toBeDefined();
        });

        it("captures an unhandled promise rejection with a non-Error reason", () => {
            expect.assertions(1);

            startTimelineCapture();

            const event = new Event("unhandledrejection") as PromiseRejectionEvent;

            Object.defineProperty(event, "reason", { value: "string reason", writable: false });

            globalThis.dispatchEvent(event);

            const recorded = getTimelineStore()
                .getGroupEvents("errors")
                .find((stored) => stored.subtitle === "string reason");

            expect(recorded).toBeDefined();
        });
    });
});
