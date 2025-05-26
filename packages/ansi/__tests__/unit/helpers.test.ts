import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store original process properties
const originalPlatform = process.platform;
const originalEnvironment = { ...process.env };
const originalWindow = (globalThis as any).window;

describe("helper Constants", () => {
    let platformSpy: ReturnType<typeof vi.spyOn>;
    let environmentSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("linux");
        // @ts-expect-error - process.env is typically readonly
        environmentSpy = vi.spyOn(process, "env", "get").mockReturnValue({ ...originalEnvironment });
        // Ensure a clean slate for window, default to non-browser for most tests
        delete (globalThis as any).window;
    });

    afterEach(() => {
        platformSpy.mockRestore();
        environmentSpy.mockRestore();

        // Restore original window object if it existed
        if (originalWindow === undefined) {
            delete (globalThis as any).window;
        } else {
            (globalThis as any).window = originalWindow;
        }

        vi.resetModules();
    });

    describe("isTerminalApp", () => {
        it("should be true when TERM_PROGRAM is Apple_Terminal and not in browser", async () => {
            expect.assertions(1);

            environmentSpy.mockReturnValue({ ...originalEnvironment, TERM_PROGRAM: "Apple_Terminal" });
            // globalThis.window is already undefined from beforeEach
            const { isTerminalApp } = await import("../../src/helpers");

            expect(isTerminalApp).toBe(true);
        });

        it("should be false when TERM_PROGRAM is not Apple_Terminal", async () => {
            expect.assertions(1);

            environmentSpy.mockReturnValue({ ...originalEnvironment, TERM_PROGRAM: "iTerm.app" });
            const { isTerminalApp } = await import("../../src/helpers");

            expect(isTerminalApp).toBe(false);
        });

        it("should be false when in a browser-like environment", async () => {
            expect.assertions(1);

            environmentSpy.mockReturnValue({ ...originalEnvironment, TERM_PROGRAM: "Apple_Terminal" });
            (globalThis as any).window = { document: {} }; // Simulate browser
            const { isTerminalApp } = await import("../../src/helpers");

            expect(isTerminalApp).toBe(false);
        });
    });

    describe("isWindows", () => {
        it("should be true when platform is win32 and not in browser", async () => {
            expect.assertions(1);

            platformSpy.mockReturnValue("win32");
            const { isWindows } = await import("../../src/helpers");

            expect(isWindows).toBe(true);
        });

        it("should be false when platform is not win32", async () => {
            expect.assertions(1);

            platformSpy.mockReturnValue("linux");
            const { isWindows } = await import("../../src/helpers");

            expect(isWindows).toBe(false);
        });

        it("should be false when in a browser-like environment", async () => {
            expect.assertions(1);

            platformSpy.mockReturnValue("win32");
            (globalThis as any).window = { document: {} }; // Simulate browser
            const { isWindows } = await import("../../src/helpers");

            expect(isWindows).toBe(false);
        });
    });
});
