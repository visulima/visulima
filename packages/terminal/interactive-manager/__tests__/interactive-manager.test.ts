import { describe, expect, it } from "vitest";

import InteractiveManager from "../src/interactive-manager";
import InteractiveStreamHook from "../src/interactive-stream-hook";

describe("interactiveManager", () => {
    it("should be instantiable with stream hooks", () => {
        expect.assertions(1);

        const stdoutHook = new InteractiveStreamHook(process.stdout);
        const stderrHook = new InteractiveStreamHook(process.stderr);
        const manager = new InteractiveManager(stdoutHook, stderrHook);

        expect(manager).toBeDefined();
    });

    it("should start as not hooked", () => {
        expect.assertions(1);

        const stdoutHook = new InteractiveStreamHook(process.stdout);
        const stderrHook = new InteractiveStreamHook(process.stderr);
        const manager = new InteractiveManager(stdoutHook, stderrHook);

        expect(manager.isHooked).toBe(false);
    });

    it("should start as not suspended", () => {
        expect.assertions(1);

        const stdoutHook = new InteractiveStreamHook(process.stdout);
        const stderrHook = new InteractiveStreamHook(process.stderr);
        const manager = new InteractiveManager(stdoutHook, stderrHook);

        expect(manager.isSuspended).toBe(false);
    });

    it("should have zero lastLength initially", () => {
        expect.assertions(1);

        const stdoutHook = new InteractiveStreamHook(process.stdout);
        const stderrHook = new InteractiveStreamHook(process.stderr);
        const manager = new InteractiveManager(stdoutHook, stderrHook);

        expect(manager.lastLength).toBe(0);
    });

    it("should have zero outside initially", () => {
        expect.assertions(1);

        const stdoutHook = new InteractiveStreamHook(process.stdout);
        const stderrHook = new InteractiveStreamHook(process.stderr);
        const manager = new InteractiveManager(stdoutHook, stderrHook);

        expect(manager.outside).toBe(0);
    });
});
