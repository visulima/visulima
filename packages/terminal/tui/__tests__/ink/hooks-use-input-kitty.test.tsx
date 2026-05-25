import { describe, expect, it } from "vitest";

import { ptyAvailable } from "../helpers/ink-run";
import term from "../helpers/ink-term";

describe("hooks-use-input-kitty", () => {
    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol super modifier", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["super"]);

        ps.write("\u001B[115;9u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol hyper modifier", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["hyper"]);

        ps.write("\u001B[104;17u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol capsLock", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["capsLock"]);

        ps.write("\u001B[97;65u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol numLock", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["numLock"]);

        ps.write("\u001B[97;129u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol super+ctrl", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["superCtrl"]);

        ps.write("\u001B[115;13u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol press event", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["press"]);

        ps.write("\u001B[97;1:1u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol repeat event", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["repeat"]);

        ps.write("\u001B[97;1:2u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol release event", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["release"]);

        ps.write("\u001B[97;1:3u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - handle kitty protocol escape key", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["escapeKitty"]);

        ps.write("\u001B[27u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - non-printable kitty key (capslock) produces empty input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["nonPrintable"]);

        ps.write("\u001B[57358u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - non-printable kitty key (f13) produces empty input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["nonPrintable"]);

        ps.write("\u001B[57376u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - non-printable kitty key (printscreen) produces empty input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["nonPrintable"]);

        ps.write("\u001B[57361u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - kitty protocol space key produces space input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["space"]);

        ps.write("\u001B[32u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - kitty protocol return key produces carriage return input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["returnKey"]);

        ps.write("\u001B[13u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("useInput - kitty protocol ctrl+letter via codepoint 1-26 produces input", async () => {
        expect.assertions(1);

        const ps = term("use-input-kitty", ["ctrlLetter"]);

        ps.write("\u001B[1;5u");
        await ps.waitForExit();

        expect(ps.output).toContain("exited");
    });
});
