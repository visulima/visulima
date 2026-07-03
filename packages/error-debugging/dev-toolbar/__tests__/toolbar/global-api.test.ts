// Uses the default jsdom environment configured in vitest.config.ts
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

// Stable mock instances — shared across the module so the factory closures
// always see the same references even when vi.clearAllMocks() resets call counts.
const mockCallServer = vi.fn().mockResolvedValue(undefined);
const mockRegisterFunction = vi.fn();
const mockOn = vi.fn().mockReturnValue(() => undefined);
const mockOff = vi.fn();
const mockOnce = vi.fn();
const mockEmit = vi.fn();
const mockRegisterApp = vi.fn();
const mockAddTimelineEvent = vi.fn();
const mockHookInstance = {
    addTimelineEvent: mockAddTimelineEvent,
    emit: mockEmit,
    off: mockOff,
    on: mockOn,
    once: mockOnce,
    registerApp: mockRegisterApp,
};

vi.mock(import("../../src/rpc/client"), () => {
    return {
        createClientRPCContext: vi.fn(() => {
            return { callServer: mockCallServer, registerFunction: mockRegisterFunction };
        }),
        default: vi.fn(() => {
            return { callServer: mockCallServer, registerFunction: mockRegisterFunction };
        }),
    };
});

vi.mock(import("../../src/hooks/index"), () => {
    return {
        getGlobalHook: vi.fn(() => mockHookInstance),
        setupGlobalHook: vi.fn(() => mockHookInstance),
    };
});

const { createGlobalAPI, setupGlobalAPI } = await import("../../src/toolbar/global-api");
const { DEFAULT_TOOLBAR_SETTINGS } = await import("../../src/types/toolbar");

// ---- helper factories -------------------------------------------------------

type DevToolbarApp = import("../../src/types/app").DevToolbarApp;

type AppManager = {
    clearNotification: (id: string) => void;
    getActiveApp: () => DevToolbarApp | undefined;
    getApps: () => DevToolbarApp[];
    registerApp: (app: DevToolbarApp) => void;
    setAppActive: (id: string, active: boolean) => void;
    setNotification: (id: string, state: boolean, level?: "info" | "warning" | "error") => void;
    toggleApp: (id: string) => Promise<boolean>;
    unregisterApp: (id: string) => void;
};

type Toolbar = { hide: () => void; show: () => void; toggle: () => void };

const makeAppManager = (overrides: Partial<AppManager> = {}): AppManager => {
    return {
        clearNotification: vi.fn(),
        getActiveApp: vi.fn().mockReturnValue(undefined),
        getApps: vi.fn().mockReturnValue([]),
        registerApp: vi.fn(),
        setAppActive: vi.fn(),
        setNotification: vi.fn(),
        toggleApp: vi.fn().mockResolvedValue(true),
        unregisterApp: vi.fn(),
        ...overrides,
    };
};

const makeToolbar = (): Toolbar => {
    return {
        hide: vi.fn(),
        show: vi.fn(),
        toggle: vi.fn(),
    };
};

const makeApp = (overrides: Partial<DevToolbarApp> = {}): DevToolbarApp => {
    return {
        icon: "<svg/>",
        id: "test-app",
        name: "Test App",
        ...overrides,
    };
};

// ---- tests ------------------------------------------------------------------

describe("createGlobalAPI", () => {
    let appManager: AppManager;
    let toolbar: Toolbar;

    beforeEach(() => {
        appManager = makeAppManager();
        toolbar = makeToolbar();
    });

    afterEach(() => {
        // Clean up global — access via bracket notation to avoid no-underscore-dangle
        delete (globalThis as Record<string, unknown>)["__VISULIMA_DEVTOOLS__"];
        vi.clearAllMocks();
    });

    it("returns an object with all expected public methods and properties", () => {
        expect.hasAssertions();

        const api = createGlobalAPI(appManager, toolbar);

        expectTypeOf(api.clearNotification).toBeFunction();
        expectTypeOf(api.closeApp).toBeFunction();
        expectTypeOf(api.getActiveApp).toBeFunction();
        expectTypeOf(api.getApps).toBeFunction();
        expectTypeOf(api.getSettings).toBeFunction();
        expectTypeOf(api.hide).toBeFunction();

        expect(api.hook).not.toBeNull();

        expectTypeOf(api.notify).toBeFunction();
        expectTypeOf(api.openApp).toBeFunction();
        expectTypeOf(api.registerApp).toBeFunction();

        expect(api.rpc).not.toBeNull();

        expectTypeOf(api.setAppActive).toBeFunction();
        expectTypeOf(api.show).toBeFunction();
        expectTypeOf(api.toggle).toBeFunction();
        expectTypeOf(api.unregisterApp).toBeFunction();
        expectTypeOf(api.updateSettings).toBeFunction();
        expectTypeOf(api.version).toBeString();
    });

    describe("toolbar visibility methods", () => {
        it("show() delegates to toolbar.show()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.show();

            expect(toolbar.show).toHaveBeenCalledTimes(1);
        });

        it("hide() delegates to toolbar.hide()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.hide();

            expect(toolbar.hide).toHaveBeenCalledTimes(1);
        });

        it("toggle() delegates to toolbar.toggle()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.toggle();

            expect(toolbar.toggle).toHaveBeenCalledTimes(1);
        });
    });

    describe("app management", () => {
        it("getApps() returns the apps from the manager", () => {
            expect.hasAssertions();

            const app = makeApp();
            const manager = makeAppManager({ getApps: vi.fn().mockReturnValue([app]) });
            const api = createGlobalAPI(manager, toolbar);

            expect(api.getApps()).toEqual([app]);
            expect(manager.getApps).toHaveBeenCalledTimes(1);
        });

        it("registerApp() delegates to appManager.registerApp()", () => {
            expect.hasAssertions();

            const app = makeApp();
            const api = createGlobalAPI(appManager, toolbar);

            api.registerApp(app);

            expect(appManager.registerApp).toHaveBeenCalledWith(app);
        });

        it("unregisterApp() delegates to appManager.unregisterApp()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.unregisterApp("my-app");

            expect(appManager.unregisterApp).toHaveBeenCalledWith("my-app");
        });

        it("getActiveApp() returns undefined when no app is active", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            expect(api.getActiveApp()).toBeUndefined();
        });

        it("getActiveApp() returns the id of the active app", () => {
            expect.hasAssertions();

            const app = makeApp({ id: "inspector" });
            const manager = makeAppManager({ getActiveApp: vi.fn().mockReturnValue(app) });
            const api = createGlobalAPI(manager, toolbar);

            expect(api.getActiveApp()).toBe("inspector");
        });

        it("openApp() calls toggleApp on the manager", async () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            await api.openApp("my-app");

            expect(appManager.toggleApp).toHaveBeenCalledWith("my-app");
        });

        it("closeApp() calls toggleApp with the active app's id", async () => {
            expect.hasAssertions();

            const app = makeApp({ id: "timeline" });
            const manager = makeAppManager({ getActiveApp: vi.fn().mockReturnValue(app) });
            const api = createGlobalAPI(manager, toolbar);

            await api.closeApp();

            expect(manager.toggleApp).toHaveBeenCalledWith("timeline");
        });

        it("closeApp() is a no-op when no app is active", async () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            await api.closeApp();

            expect(appManager.toggleApp).not.toHaveBeenCalled();
        });

        it("setAppActive() delegates to appManager.setAppActive()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.setAppActive("inspector", true);

            expect(appManager.setAppActive).toHaveBeenCalledWith("inspector", true);
        });
    });

    describe("notifications", () => {
        it("notify() calls setNotification with state=true and the given level", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.notify("inspector", "warning");

            expect(appManager.setNotification).toHaveBeenCalledWith("inspector", true, "warning");
        });

        it("clearNotification() delegates to appManager.clearNotification()", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            api.clearNotification("inspector");

            expect(appManager.clearNotification).toHaveBeenCalledWith("inspector");
        });
    });

    describe("settings", () => {
        it("getSettings() returns defaults when localStorage is empty", () => {
            expect.hasAssertions();

            localStorage.clear();

            const api = createGlobalAPI(appManager, toolbar);
            const settings = api.getSettings();

            expect(settings).toEqual(DEFAULT_TOOLBAR_SETTINGS);
        });

        it("updateSettings() persists partial changes and merges with defaults", () => {
            expect.hasAssertions();

            localStorage.clear();

            const api = createGlobalAPI(appManager, toolbar);

            api.updateSettings({ placement: "top-right" });

            const saved = api.getSettings();

            expect(saved.placement).toBe("top-right");
            expect(saved.defaultVisible).toBe(DEFAULT_TOOLBAR_SETTINGS.defaultVisible);
            expect(saved.showNotifications).toBe(DEFAULT_TOOLBAR_SETTINGS.showNotifications);
        });
    });

    describe("rpc proxy", () => {
        it("rpc is not null (Proxy)", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);

            expect(api.rpc).not.toBeNull();
        });

        it("any property access on rpc returns a function", () => {
            expect.hasAssertions();

            const api = createGlobalAPI(appManager, toolbar);
            const rpc = api.rpc as Record<string, unknown>;

            // The Proxy intercepts any property get and returns a function wrapper.
            // Use toBeTypeOf for runtime assertion so expect.hasAssertions() is satisfied.
            expect(rpc["getViteConfig"]).toBeTypeOf("function");
            expect(rpc["openInEditor"]).toBeTypeOf("function");
        });
    });
});

describe("setupGlobalAPI", () => {
    afterEach(() => {
        delete (globalThis as Record<string, unknown>)["__VISULIMA_DEVTOOLS__"];
        vi.clearAllMocks();
    });

    it("attaches the api to window.__VISULIMA_DEVTOOLS__ in a DOM environment", () => {
        expect.hasAssertions();

        // In jsdom environment, globalThis.window is defined.
        const manager = makeAppManager();
        const toolbar = makeToolbar();
        const api = createGlobalAPI(manager, toolbar);

        setupGlobalAPI(api);

        expect((globalThis as Record<string, unknown>)["__VISULIMA_DEVTOOLS__"]).toBe(api);
    });

    it("idempotent — calling setupGlobalAPI twice replaces the reference each time", () => {
        expect.hasAssertions();

        const manager = makeAppManager();
        const toolbar = makeToolbar();
        const api1 = createGlobalAPI(manager, toolbar);
        const api2 = createGlobalAPI(manager, toolbar);

        setupGlobalAPI(api1);
        setupGlobalAPI(api2);

        // The last call wins
        expect((globalThis as Record<string, unknown>)["__VISULIMA_DEVTOOLS__"]).toBe(api2);
    });
});
