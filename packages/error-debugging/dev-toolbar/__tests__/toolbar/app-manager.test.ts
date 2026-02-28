import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppManager } from "../../src/toolbar/app-manager";
import type { DevToolbarApp } from "../../src/types/app";

// Minimal mock that satisfies the ShadowRoot type where only a reference is needed.
const makeShadowRoot = () => ({}) as unknown as ShadowRoot;

const makeCanvas = () => ({
    element: {} as HTMLElement,
    shadowRoot: makeShadowRoot(),
});

const makeApp = (overrides: Partial<DevToolbarApp> = {}): DevToolbarApp => ({
    icon: "<svg/>",
    id: "test-app",
    name: "Test App",
    ...overrides,
});

describe("AppManager", () => {
    let manager: AppManager;

    beforeEach(() => {
        manager = new AppManager();
    });

    describe("registerApp", () => {
        it("stores the app so it can be retrieved by id", () => {
            const app = makeApp();

            manager.registerApp(app);

            expect(manager.getApp("test-app")).toBeDefined();
        });

        it("sets the app active to false initially", () => {
            manager.registerApp(makeApp());

            expect(manager.getApp("test-app")!.active).toBe(false);
        });

        it("sets builtIn to false by default", () => {
            manager.registerApp(makeApp());

            expect(manager.getApp("test-app")!.builtIn).toBe(false);
        });

        it("marks the app as builtIn when second argument is true", () => {
            manager.registerApp(makeApp(), true);

            expect(manager.getApp("test-app")!.builtIn).toBe(true);
        });

        it("sets initial status to 'ready'", () => {
            manager.registerApp(makeApp());

            expect(manager.getApp("test-app")!.status).toBe("ready");
        });

        it("sets initial notification state to false", () => {
            manager.registerApp(makeApp());

            expect(manager.getApp("test-app")!.notification).toEqual({ state: false });
        });

        it("attaches an eventTarget to the app state", () => {
            manager.registerApp(makeApp());

            expect(manager.getApp("test-app")!.eventTarget).toBeDefined();
        });

        it("allows registering multiple apps", () => {
            manager.registerApp(makeApp({ id: "app-1" }));
            manager.registerApp(makeApp({ id: "app-2" }));

            expect(manager.getAllApps()).toHaveLength(2);
        });
    });

    describe("getApp", () => {
        it("returns undefined for an unknown app id", () => {
            expect(manager.getApp("unknown")).toBeUndefined();
        });

        it("returns the app state for a registered app", () => {
            const app = makeApp();

            manager.registerApp(app);

            expect(manager.getApp("test-app")?.id).toBe("test-app");
        });
    });

    describe("getAllApps", () => {
        it("returns an empty array when no apps are registered", () => {
            expect(manager.getAllApps()).toHaveLength(0);
        });

        it("returns all registered apps", () => {
            manager.registerApp(makeApp({ id: "a" }));
            manager.registerApp(makeApp({ id: "b" }));

            expect(manager.getAllApps()).toHaveLength(2);
        });
    });

    describe("getActiveApp", () => {
        it("returns undefined when no app is active", () => {
            manager.registerApp(makeApp());

            expect(manager.getActiveApp()).toBeUndefined();
        });

        it("returns the active app after openApp", async () => {
            manager.registerApp(makeApp());
            manager.setAppCanvas("test-app", makeCanvas());
            await manager.openApp("test-app");

            expect(manager.getActiveApp()?.id).toBe("test-app");
        });
    });

    describe("openApp", () => {
        it("returns false for an unknown app id", async () => {
            expect(await manager.openApp("no-such-app")).toBe(false);
        });

        it("sets the app's active flag to true", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");

            expect(manager.getApp("test-app")!.active).toBe(true);
        });

        it("sets status to 'ready' when there is no init function", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");

            expect(manager.getApp("test-app")!.status).toBe("ready");
        });

        it("calls init() when a canvas is available and app has not been initialized", async () => {
            const init = vi.fn();

            manager.registerApp(makeApp({ init }));
            manager.setAppCanvas("test-app", makeCanvas());
            await manager.openApp("test-app");

            expect(init).toHaveBeenCalledOnce();
        });

        it("passes shadowRoot, eventTarget, and helpers to init()", async () => {
            const init = vi.fn();
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ init }));
            manager.setAppCanvas("test-app", canvas);
            await manager.openApp("test-app");

            const [shadowRoot, eventTarget, helpers] = init.mock.calls[0] as [ShadowRoot, EventTarget, object];

            expect(shadowRoot).toBe(canvas.shadowRoot);
            expect(eventTarget).toBeDefined();
            expect(helpers).toHaveProperty("rpc");
        });

        it("marks the app as initialized after successful init()", async () => {
            manager.registerApp(makeApp({ init: vi.fn() }));
            manager.setAppCanvas("test-app", makeCanvas());
            await manager.openApp("test-app");

            expect(manager.isAppInitialized("test-app")).toBe(true);
        });

        it("does not call init() a second time if already initialized", async () => {
            const init = vi.fn();

            manager.registerApp(makeApp({ init }));
            manager.setAppCanvas("test-app", makeCanvas());
            await manager.openApp("test-app");
            await manager.closeApp("test-app");
            await manager.openApp("test-app");

            expect(init).toHaveBeenCalledTimes(1);
        });

        it("sets status to 'pending' when canvas is not yet available", async () => {
            manager.registerApp(makeApp({ init: vi.fn() }));
            // No canvas set
            await manager.openApp("test-app");

            expect(manager.getApp("test-app")!.status).toBe("pending");
        });

        it("sets status to 'error' and returns false when init() throws", async () => {
            const init = vi.fn().mockRejectedValue(new Error("init fail"));

            manager.registerApp(makeApp({ init }));
            manager.setAppCanvas("test-app", makeCanvas());

            const result = await manager.openApp("test-app");

            expect(result).toBe(false);
            expect(manager.getApp("test-app")!.status).toBe("error");
        });

        it("does not automatically close the previously active app (use toggleApp for that)", async () => {
            // openApp() focuses the new app but leaves the previous app's active flag unchanged.
            // Switching apps via close-then-open requires toggleApp().
            manager.registerApp(makeApp({ id: "app-1" }));
            manager.registerApp(makeApp({ id: "app-2" }));
            await manager.openApp("app-1");
            await manager.openApp("app-2");

            // Both apps end up with active=true because openApp() doesn't close others.
            expect(manager.getApp("app-1")!.active).toBe(true);
            expect(manager.getApp("app-2")!.active).toBe(true);
        });

        it("awaits async init() functions", async () => {
            let resolved = false;
            const init = vi.fn().mockImplementation(async () => {
                await Promise.resolve();
                resolved = true;
            });

            manager.registerApp(makeApp({ init }));
            manager.setAppCanvas("test-app", makeCanvas());
            await manager.openApp("test-app");

            expect(resolved).toBe(true);
        });
    });

    describe("closeApp", () => {
        it("returns false for an unknown app id", async () => {
            expect(await manager.closeApp("no-such-app")).toBe(false);
        });

        it("returns false if the app is not active", async () => {
            manager.registerApp(makeApp());

            expect(await manager.closeApp("test-app")).toBe(false);
        });

        it("sets active to false after closing", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");
            await manager.closeApp("test-app");

            expect(manager.getApp("test-app")!.active).toBe(false);
        });

        it("clears activeAppId after closing the active app", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");
            await manager.closeApp("test-app");

            expect(manager.getActiveApp()).toBeUndefined();
        });

        it("allows close when beforeTogglingOff returns true", async () => {
            const beforeTogglingOff = vi.fn().mockReturnValue(true);
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ beforeTogglingOff }));
            manager.setAppCanvas("test-app", canvas);
            await manager.openApp("test-app");

            const result = await manager.closeApp("test-app");

            expect(result).toBe(true);
            expect(manager.getApp("test-app")!.active).toBe(false);
        });

        it("prevents close when beforeTogglingOff returns false", async () => {
            const beforeTogglingOff = vi.fn().mockReturnValue(false);
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ beforeTogglingOff }));
            manager.setAppCanvas("test-app", canvas);
            await manager.openApp("test-app");

            const result = await manager.closeApp("test-app");

            expect(result).toBe(false);
            expect(manager.getApp("test-app")!.active).toBe(true);
        });

        it("allows close when async beforeTogglingOff resolves to true", async () => {
            const beforeTogglingOff = vi.fn().mockResolvedValue(true);
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ beforeTogglingOff }));
            manager.setAppCanvas("test-app", canvas);
            await manager.openApp("test-app");

            const result = await manager.closeApp("test-app");

            expect(result).toBe(true);
        });

        it("allows close when beforeTogglingOff throws (fail-safe)", async () => {
            const beforeTogglingOff = vi.fn().mockRejectedValue(new Error("guard error"));
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ beforeTogglingOff }));
            manager.setAppCanvas("test-app", canvas);
            await manager.openApp("test-app");

            const result = await manager.closeApp("test-app");

            expect(result).toBe(true);
        });
    });

    describe("toggleApp", () => {
        it("returns false for an unknown app id", async () => {
            expect(await manager.toggleApp("no-such-app")).toBe(false);
        });

        it("opens an inactive app", async () => {
            manager.registerApp(makeApp());
            await manager.toggleApp("test-app");

            expect(manager.getApp("test-app")!.active).toBe(true);
        });

        it("closes an active app", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");
            await manager.toggleApp("test-app");

            expect(manager.getApp("test-app")!.active).toBe(false);
        });

        it("closes the previously active app before opening a new one", async () => {
            manager.registerApp(makeApp({ id: "app-1" }));
            manager.registerApp(makeApp({ id: "app-2" }));
            await manager.toggleApp("app-1");
            await manager.toggleApp("app-2");

            expect(manager.getApp("app-1")!.active).toBe(false);
            expect(manager.getApp("app-2")!.active).toBe(true);
        });
    });

    describe("isAppInitialized / markAppInitialized", () => {
        it("returns false for a freshly registered app", () => {
            manager.registerApp(makeApp());

            expect(manager.isAppInitialized("test-app")).toBe(false);
        });

        it("returns true after markAppInitialized is called", () => {
            manager.registerApp(makeApp());
            manager.markAppInitialized("test-app");

            expect(manager.isAppInitialized("test-app")).toBe(true);
        });
    });

    describe("setNotification / clearNotification", () => {
        it("sets notification state and level", () => {
            manager.registerApp(makeApp());
            manager.setNotification("test-app", true, "error");

            expect(manager.getApp("test-app")!.notification).toEqual({
                level: "error",
                state: true,
            });
        });

        it("sets notification state without level", () => {
            manager.registerApp(makeApp());
            manager.setNotification("test-app", true);

            expect(manager.getApp("test-app")!.notification.state).toBe(true);
        });

        it("clearNotification resets state to false", () => {
            manager.registerApp(makeApp());
            manager.setNotification("test-app", true, "warning");
            manager.clearNotification("test-app");

            expect(manager.getApp("test-app")!.notification).toEqual({ state: false });
        });

        it("setNotification is a no-op for unknown app id", () => {
            expect(() => manager.setNotification("ghost", true)).not.toThrow();
        });

        it("clearNotification is a no-op for unknown app id", () => {
            expect(() => manager.clearNotification("ghost")).not.toThrow();
        });
    });

    describe("getAppCanvas / setAppCanvas", () => {
        it("returns null before a canvas is set", () => {
            manager.registerApp(makeApp());

            expect(manager.getAppCanvas("test-app")).toBeNull();
        });

        it("returns the canvas after it has been set", () => {
            const canvas = makeCanvas();

            manager.registerApp(makeApp());
            manager.setAppCanvas("test-app", canvas);

            expect(manager.getAppCanvas("test-app")).toBe(canvas);
        });
    });

    describe("unregisterApp", () => {
        it("removes the app from the registry", async () => {
            manager.registerApp(makeApp());
            await manager.unregisterApp("test-app");

            expect(manager.getApp("test-app")).toBeUndefined();
        });

        it("clears activeAppId when unregistering the active app", async () => {
            manager.registerApp(makeApp());
            await manager.openApp("test-app");
            await manager.unregisterApp("test-app");

            expect(manager.getActiveApp()).toBeUndefined();
        });

        it("calls destroy() on an initialized app", async () => {
            const destroy = vi.fn().mockResolvedValue(undefined);
            const canvas = makeCanvas();

            manager.registerApp(makeApp({ destroy }));
            manager.setAppCanvas("test-app", canvas);
            manager.markAppInitialized("test-app");
            await manager.unregisterApp("test-app");

            expect(destroy).toHaveBeenCalledWith(canvas.shadowRoot);
        });

        it("does not call destroy() if the app was never initialized", async () => {
            const destroy = vi.fn();

            manager.registerApp(makeApp({ destroy }));
            await manager.unregisterApp("test-app");

            expect(destroy).not.toHaveBeenCalled();
        });

        it("is safe to call for an unknown app id", async () => {
            await expect(manager.unregisterApp("non-existent")).resolves.toBeUndefined();
        });
    });
});
