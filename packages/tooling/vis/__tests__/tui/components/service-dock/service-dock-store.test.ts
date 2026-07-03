import { describe, expect, it, vi } from "vitest";

import { ServiceDockStore } from "../../../../src/tui/components/service-dock/service-dock-store";

describe(ServiceDockStore, () => {
    it("starts with all services pending and dockState boot", () => {
        expect.assertions(3);

        const store = new ServiceDockStore(["api:db", "api:redis"]);

        expect(store.getIds()).toStrictEqual(["api:db", "api:redis"]);
        expect(store.getState("api:db")?.status).toBe("pending");
        expect(store.getDockState()).toBe("boot");
    });

    it("transitions through starting → started → ready", () => {
        expect.assertions(3);

        const store = new ServiceDockStore(["api:db"]);

        store.markStarting("api:db");

        expect(store.getState("api:db")?.status).toBe("starting");

        store.markStarted("api:db", 4242);

        expect(store.getState("api:db")?.status).toBe("starting");

        store.markReady("api:db", { host: "127.0.0.1", port: 5432 });

        expect(store.getState("api:db")).toMatchObject({ port: 5432, status: "ready" });
    });

    it("flips dockState to ready once every service is ready", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db", "api:redis"]);

        store.markReady("api:db", { host: "127.0.0.1", port: 5432 });

        expect(store.getDockState()).toBe("boot");

        store.markReady("api:redis", { host: "127.0.0.1", port: 6379 });

        expect(store.getDockState()).toBe("ready");
    });

    it("transitions to crash when any service crashes", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db", "api:redis"]);

        store.markReady("api:db", { host: "127.0.0.1", port: 5432 });
        store.markReady("api:redis", { host: "127.0.0.1", port: 6379 });

        expect(store.getDockState()).toBe("ready");

        store.markCrashed("api:db", ["last log line"]);

        expect(store.getDockState()).toBe("crash");
    });

    it("captures the failure reason or last tail line on crashed", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);

        store.markCrashed("api:db", ["something terrible happened"]);

        expect(store.getState("api:db")?.errorMessage).toBe("something terrible happened");

        store.markCrashed("api:db", []);

        expect(store.getState("api:db")?.errorMessage).toBe("process exited");
    });

    it("returns to starting when retry resets via markStarting", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);

        store.markCrashed("api:db", ["dead"]);

        expect(store.getState("api:db")?.status).toBe("crashed");

        store.markStarting("api:db");

        expect(store.getState("api:db")).toMatchObject({ errorMessage: undefined, status: "starting" });
    });

    it("appendLog tracks lastLine and bounds the tail buffer", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);

        for (let index = 0; index < 500; index += 1) {
            store.appendLog("api:db", `line ${index}\n`);
        }

        const state = store.getState("api:db");

        expect(state?.lastLine).toBe("line 499");
        expect(state?.tailLines.length).toBeLessThanOrEqual(256);
    });

    it("notifies subscribers on state changes", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);
        const listener = vi.fn();

        const unsubscribe = store.subscribe(listener);

        store.markStarting("api:db");
        store.markReady("api:db", { host: "127.0.0.1", port: 5432 });

        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        store.markCrashed("api:db", []);

        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("registerService is idempotent and adds new ids on the fly", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);

        store.registerService("api:redis");
        store.registerService("api:redis");

        expect(store.getIds()).toStrictEqual(["api:db", "api:redis"]);
        expect(store.getState("api:redis")?.status).toBe("pending");
    });

    it("abortBoot fails all in-flight services in one shot", () => {
        expect.assertions(3);

        const store = new ServiceDockStore(["api:db", "api:redis", "api:queue"]);

        store.markReady("api:queue", { host: "127.0.0.1", port: 7777 });
        store.markStarting("api:db");
        store.abortBoot("user aborted");

        expect(store.getState("api:db")).toMatchObject({ errorMessage: "user aborted", status: "failed" });
        expect(store.getState("api:redis")).toMatchObject({ errorMessage: "user aborted", status: "failed" });
        expect(store.getState("api:queue")?.status).toBe("ready");
    });

    it("strips ANSI escapes and CRs from log content so they can't corrupt the dock layout", () => {
        // Cursor-move escapes (\x1b[60G) or CR-rewind progress lines would
        // otherwise be honored by the terminal when the row's `lastLine` is
        // rendered, leaking content past the dock's right border. Sanitize
        // at ingest so every consumer (rows, crash header) gets clean text.
        expect.assertions(3);

        const store = new ServiceDockStore(["api:db"]);

        const ansi = "[31m[1mrunning[0m migrations[60G";

        store.appendLog("api:db", `${ansi}\r\n`);

        expect(store.getState("api:db")?.lastLine).toBe("running migrations");

        store.markCrashed("api:db", [ansi, "second\rline"]);

        expect(store.getState("api:db")?.tailLines).toStrictEqual(["running migrations", "secondline"]);
        expect(store.getState("api:db")?.errorMessage).toBe("secondline");
    });

    it("getSnapshot returns an immutable map snapshot", () => {
        expect.assertions(2);

        const store = new ServiceDockStore(["api:db"]);
        const before = store.getSnapshot();

        store.markStarting("api:db");
        const after = store.getSnapshot();

        expect(before.get("api:db")?.status).toBe("pending");
        expect(after.get("api:db")?.status).toBe("starting");
    });
});
