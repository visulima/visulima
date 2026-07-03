import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildRunOptions } from "../../src/commands/staged/handler";
import { CONCURRENT_ENV_VAR, parseConcurrent } from "../../src/staged/cli-parse";

describe(parseConcurrent, () => {
    it("returns true for the literal string 'true'", () => {
        expect.assertions(1);

        expect(parseConcurrent("true")).toBe(true);
    });

    it("returns true for an empty string — matches the CLI flag with no value", () => {
        expect.assertions(1);

        expect(parseConcurrent("")).toBe(true);
    });

    it("returns false for the literal string 'false'", () => {
        expect.assertions(1);

        expect(parseConcurrent("false")).toBe(false);
    });

    it("parses positive integer strings to numbers", () => {
        expect.assertions(2);

        expect(parseConcurrent("4")).toBe(4);
        expect(parseConcurrent("16")).toBe(16);
    });

    it("falls back to true when the value is not a recognized keyword or integer", () => {
        expect.assertions(2);

        expect(parseConcurrent("auto")).toBe(true);
        expect(parseConcurrent("not-a-number")).toBe(true);
    });

    it("trims whitespace before parsing — tolerates quotes in .env files and shells", () => {
        expect.assertions(2);

        expect(parseConcurrent("  true  ")).toBe(true);
        expect(parseConcurrent("  4 ")).toBe(4);
    });
});

describe("buildRunOptions — VIS_STAGED_CONCURRENT env var fallback", () => {
    let previous: string | undefined;

    beforeEach(() => {
        previous = process.env[CONCURRENT_ENV_VAR];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- CONCURRENT_ENV_VAR is a typed string constant
        delete process.env[CONCURRENT_ENV_VAR];
    });

    afterEach(() => {
        if (previous === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- CONCURRENT_ENV_VAR is a typed string constant
            delete process.env[CONCURRENT_ENV_VAR];
        } else {
            process.env[CONCURRENT_ENV_VAR] = previous;
        }
    });

    it("falls back to the env var when the --concurrent flag is absent", () => {
        expect.assertions(1);

        process.env[CONCURRENT_ENV_VAR] = "2";

        const options = buildRunOptions({}, undefined);

        expect(options.concurrent).toBe(2);
    });

    it("prefers the CLI flag over the env var when both are present", () => {
        expect.assertions(1);

        process.env[CONCURRENT_ENV_VAR] = "2";

        const options = buildRunOptions({ concurrent: "false" }, undefined);

        expect(options.concurrent).toBe(false);
    });

    it("leaves `concurrent` unset when neither flag nor env var is supplied — runStaged applies its own default", () => {
        expect.assertions(1);

        const options = buildRunOptions({}, undefined);

        expect(options.concurrent).toBeUndefined();
    });

    it("surfaces --force-kill as killSignal: SIGKILL", () => {
        expect.assertions(1);

        const options = buildRunOptions({ "force-kill": true }, undefined);

        expect(options.killSignal).toBe("SIGKILL");
    });

    it("leaves killSignal unset when --force-kill is not passed", () => {
        expect.assertions(1);

        const options = buildRunOptions({}, undefined);

        expect(options.killSignal).toBeUndefined();
    });
});
