import { describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import term from "../helpers/ink-term";

describe("hooks-use-input-ime", () => {
    it.skipIf(!ptyAvailable)("useInput - buffers Chinese IME input", async () => {
        expect.assertions(1);

        const ps = term("use-input-ime", ["chinese"]);

        // Simulate rapid IME character delivery
        ps.write("\u4F60");
        ps.write("\u597D");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - buffers Japanese IME input", async () => {
        expect.assertions(1);

        const ps = term("use-input-ime", ["japanese"]);

        ps.write("\u3053\u3093\u306B\u3061\u306F");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - buffers Korean IME input", async () => {
        expect.assertions(1);

        const ps = term("use-input-ime", ["korean"]);

        ps.write("\uC548\uB155");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - buffers Thai IME input", async () => {
        expect.assertions(1);

        const ps = term("use-input-ime", ["thai"]);

        ps.write("\u0E2A\u0E27\u0E31\u0E2A\u0E14\u0E35");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - flushes IME buffer before processing regular ASCII input", async () => {
        expect.assertions(1);

        const ps = term("use-input-ime", ["mixedInput"]);

        ps.write("\u4F60");

        // Wait for IME buffer to flush (imeTimeout is 30ms in fixture),
        // then send ASCII which should be processed normally.
        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });
        ps.write("x");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });
});
