import { describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import term from "../helpers/ink-term";

describe("hooks-use-input-navigation", () => {
    it.skipIf(!ptyAvailable)("useInput - handle up arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["upArrow"]);

        ps.write("\u001B[A");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle down arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["downArrow"]);

        ps.write("\u001B[B");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle left arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["leftArrow"]);

        ps.write("\u001B[D");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle right arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["rightArrow"]);

        ps.write("\u001B[C");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handles rapid arrows and enter in one chunk", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["rapidArrowsEnter"]);

        ps.write("\u001B[B\u001B[B\u001B[B\r");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta + up arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["upArrowMeta"]);

        ps.write("\u001B\u001B[A");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta + down arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["downArrowMeta"]);

        ps.write("\u001B\u001B[B");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta + left arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["leftArrowMeta"]);

        ps.write("\u001B\u001B[D");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle meta + right arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["rightArrowMeta"]);

        ps.write("\u001B\u001B[C");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle ctrl + up arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["upArrowCtrl"]);

        ps.write("\u001B[1;5A");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle ctrl + down arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["downArrowCtrl"]);

        ps.write("\u001B[1;5B");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle ctrl + left arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["leftArrowCtrl"]);

        ps.write("\u001B[1;5D");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle ctrl + right arrow", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["rightArrowCtrl"]);

        ps.write("\u001B[1;5C");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle page down", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["pageDown"]);

        ps.write("\u001B[6~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle page up", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["pageUp"]);

        ps.write("\u001B[5~");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle home", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["home"]);

        ps.write("\u001B[H");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle end", async () => {
        expect.assertions(1);

        const ps = term("use-input", ["end"]);

        ps.write("\u001B[F");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });
});
