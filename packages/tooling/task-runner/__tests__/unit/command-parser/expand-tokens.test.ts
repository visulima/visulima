/* eslint-disable no-template-curly-in-string -- literal `${...}` strings are intentional token-syntax inputs */
import { describe, expect, it } from "vitest";

import { expandTokens, expandTokensInString } from "../../../src/command-parser/expand-tokens";
import { parseCommands } from "../../../src/command-parser/index";

describe(expandTokensInString, () => {
    it("substitutes ${affected.files} with bare paths when they need no escaping", () => {
        expect.assertions(1);

        const out = expandTokensInString("eslint ${affected.files}", {
            affectedFiles: ["src/a.ts", "src/b.ts"],
        });

        expect(out).toBe("eslint src/a.ts src/b.ts");
    });

    it("supports the changed_files alias", () => {
        expect.assertions(1);

        const out = expandTokensInString("prettier ${changed_files}", {
            affectedFiles: ["pkg/x.ts"],
        });

        expect(out).toBe("prettier pkg/x.ts");
    });

    it("expands ${... | flag '--file'} into per-file flag pairs", () => {
        expect.assertions(1);

        const out = expandTokensInString("nyc ${changed_files | flag '--file'}", {
            affectedFiles: ["a.js", "b.js"],
        });

        expect(out).toBe("nyc --file a.js --file b.js");
    });

    it("supports double-quoted flag form", () => {
        expect.assertions(1);

        const out = expandTokensInString('tool ${affected.files | flag "-f"}', {
            affectedFiles: ["a", "b"],
        });

        expect(out).toBe("tool -f a -f b");
    });

    it("returns an empty token expansion when no files match", () => {
        expect.assertions(1);

        const out = expandTokensInString("eslint ${affected.files}", { affectedFiles: [] });

        expect(out).toBe("eslint ");
    });

    it("escapes literal token via backslash", () => {
        expect.assertions(1);

        const out = expandTokensInString("echo \\${affected.files}", { affectedFiles: ["a"] });

        expect(out).toBe("echo ${affected.files}");
    });

    it("leaves unknown tokens untouched", () => {
        expect.assertions(1);

        const out = expandTokensInString("echo ${HOME}", { affectedFiles: [] });

        expect(out).toBe("echo ${HOME}");
    });

    it("rewrites paths relative to projectRoot and drops outsiders", () => {
        expect.assertions(1);

        const out = expandTokensInString("eslint ${affected.files}", {
            affectedFiles: ["packages/app/src/a.ts", "packages/app/src/b.ts", "other/c.ts"],
            projectRoot: "packages/app",
        });

        expect(out).toBe("eslint src/a.ts src/b.ts");
    });

    it("escapes single quotes inside paths (POSIX)", () => {
        expect.assertions(1);

        // The cmd.exe form uses different quoting, so this single-quote
        // escape rule is asserted only on POSIX shells.
        if (process.platform === "win32") {
            return;
        }

        const out = expandTokensInString("ls ${affected.files}", {
            affectedFiles: ["a'b.ts"],
        });

        expect(out).toBe(String.raw`ls 'a'\''b.ts'`);
    });

    it("ignores tokens when no affected files are configured", () => {
        expect.assertions(1);

        const out = expandTokensInString("echo ${affected.files}", {});

        expect(out).toBe("echo ");
    });

    it("expands multiple tokens in the same command", () => {
        expect.assertions(1);

        const out = expandTokensInString("eslint ${affected.files} --ignore ${changed_files}", {
            affectedFiles: ["a.ts", "b.ts"],
        });

        expect(out).toBe("eslint a.ts b.ts --ignore a.ts b.ts");
    });

    it("mixes flag and bare forms in one command", () => {
        expect.assertions(1);

        const out = expandTokensInString("nyc ${changed_files | flag '--file'} -- mocha ${affected.files}", {
            affectedFiles: ["a.ts"],
        });

        expect(out).toBe("nyc --file a.ts -- mocha a.ts");
    });

    it("emits paths cleanly when followed by literal text", () => {
        expect.assertions(1);

        const out = expandTokensInString("eslint ${affected.files} --quiet", {
            affectedFiles: ["a.ts"],
        });

        expect(out).toBe("eslint a.ts --quiet");
    });
});

describe(expandTokens, () => {
    it("returns the same config when no token is present", () => {
        expect.assertions(2);

        const input = { command: "echo hi" };
        const out = expandTokens(input, { affectedFiles: ["a"] });

        expect(out).toBe(input);
        expect(out.command).toBe("echo hi");
    });

    it("returns a new config when tokens expand", () => {
        expect.assertions(2);

        const input = { command: "lint ${affected.files}" };
        const out = expandTokens(input, { affectedFiles: ["a"] });

        expect(out).not.toBe(input);
        expect(out.command).toBe("lint a");
    });
});

describe("parseCommands token integration", () => {
    it("expands tokens before placeholder arguments", () => {
        expect.assertions(1);

        const [out] = parseCommands(["lint ${affected.files} {1}"], {
            additionalArguments: ["--quiet"],
            tokens: { affectedFiles: ["a.ts"] },
        });

        expect(out?.command).toBe("lint a.ts --quiet");
    });

    it("does nothing when no tokens are passed", () => {
        expect.assertions(1);

        const [out] = parseCommands(["lint ${affected.files}"]);

        expect(out?.command).toBe("lint ${affected.files}");
    });
});
