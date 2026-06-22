/**
 * Tests for `${VAR}` / `$VAR` interpolation in `.env` loading
 * (dotenv-expand semantics): substitution from the already-loaded cascade then
 * `process.env`, `${VAR:-default}` fallbacks, `\$` literal escape, and the rule
 * that single-quoted values are NEVER expanded while double-quoted/unquoted are.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadEnvFile } from "../../src/task/target-options";

describe("env `${VAR}` expansion", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-env-expand-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("expands `${VAR}` referencing an earlier key in the same file", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".env"), "BASE=hello\nGREETING=${BASE} world");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.BASE).toBe("hello");
        expect(env.GREETING).toBe("hello world");
    });

    it("expands bare `$VAR` form", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "HOST=localhost\nURL=http://$HOST/path");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.URL).toBe("http://localhost/path");
    });

    it("expands nested references across cascade files (later file sees earlier keys)", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "PROTOCOL=https\nHOST=example.com");
        writeFileSync(join(tmpDir, ".env.local"), "ENDPOINT=${PROTOCOL}://${HOST}/api");

        const env = loadEnvFile(tmpDir, [".env", ".env.local"]);

        expect(env.ENDPOINT).toBe("https://example.com/api");
    });

    it("uses `${VAR:-default}` when the variable is unset", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "PORT=${MISSING:-3000}");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.PORT).toBe("3000");
    });

    it("prefers the value over `${VAR:-default}` when the variable is set", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "HOST=set\nADDR=${HOST:-fallback}");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.ADDR).toBe("set");
    });

    it("resolves a braced-nested default `${A:-${B}}` on the outer brace", () => {
        expect.assertions(1);

        // The inner `${OTHER}` must not close the outer `${MISSING:- ...}`; depth
        // tracking finds the matching outer `}`.
        writeFileSync(join(tmpDir, ".env"), "OTHER=fromB\nVALUE=${MISSING:-${OTHER}}");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.VALUE).toBe("fromB");
    });

    it("reads from process.env when the cascade has no match", () => {
        expect.assertions(1);

        process.env["VIS_TEST_EXPAND_FROM_PROCESS"] = "from-process";

        try {
            writeFileSync(join(tmpDir, ".env"), "VALUE=${VIS_TEST_EXPAND_FROM_PROCESS}");

            const env = loadEnvFile(tmpDir, ".env");

            expect(env.VALUE).toBe("from-process");
        } finally {
            delete process.env["VIS_TEST_EXPAND_FROM_PROCESS"];
        }
    });

    it("treats `\\$` as a literal `$` and does not expand", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), String.raw`PRICE=\${AMOUNT}`);

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.PRICE).toBe("${AMOUNT}");
    });

    it("does NOT expand inside single-quoted values", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "BASE=hello\nLITERAL='${BASE} world'");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.LITERAL).toBe("${BASE} world");
    });

    it("dOES expand inside double-quoted values", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "BASE=hello\nQUOTED=\"${BASE} world\"");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.QUOTED).toBe("hello world");
    });

    it("substitutes an empty string for an unset `${VAR}` with no default", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "VALUE=[${NOT_SET_ANYWHERE_VIS}]");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.VALUE).toBe("[]");
    });
});
