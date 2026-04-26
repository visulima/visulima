import { describe, expect, it } from "vitest";

import { isBareMigrateInvocation } from "../src/commands/migrate/detect-bare";

describe(isBareMigrateInvocation, () => {
    describe("positive matches", () => {
        it("returns true for bare `migrate`", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation(["migrate"])).toBe(true);
        });

        it("returns true when only long flags are present (--flag=value form)", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation(["migrate", "--cwd=/tmp/foo", "--debug"])).toBe(true);
        });

        it("returns true when a boolean global flag precedes the subcommand", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation(["--debug", "migrate"])).toBe(true);
        });
    });

    describe("negative matches", () => {
        it("returns false for `migrate deps`", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation(["migrate", "deps"])).toBe(false);
        });

        it("returns false for nested `migrate <any-subcommand>`", () => {
            expect.assertions(4);

            expect(isBareMigrateInvocation(["migrate", "lint-staged"])).toBe(false);
            expect(isBareMigrateInvocation(["migrate", "turborepo"])).toBe(false);
            expect(isBareMigrateInvocation(["migrate", "gitleaks"])).toBe(false);
            expect(isBareMigrateInvocation(["migrate", "verify"])).toBe(false);
        });

        it("returns false for a completely different command", () => {
            expect.assertions(2);

            expect(isBareMigrateInvocation(["update"])).toBe(false);
            expect(isBareMigrateInvocation(["run", "build"])).toBe(false);
        });

        it("returns false for empty argv", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation([])).toBe(false);
        });

        it("returns false when --help is present so cerebro can render help", () => {
            expect.assertions(2);

            expect(isBareMigrateInvocation(["migrate", "--help"])).toBe(false);
            expect(isBareMigrateInvocation(["migrate", "-h"])).toBe(false);
        });

        it("returns false when --version is present", () => {
            expect.assertions(2);

            expect(isBareMigrateInvocation(["migrate", "--version"])).toBe(false);
            expect(isBareMigrateInvocation(["migrate", "-V"])).toBe(false);
        });

        it("returns false when argv contains positional garbage after migrate", () => {
            expect.assertions(1);

            // Unknown trailing positional should NOT trigger the TUI — let cerebro
            // produce its standard CommandNotFoundError instead.
            expect(isBareMigrateInvocation(["migrate", "something-else"])).toBe(false);
        });
    });

    describe("flag value consumption", () => {
        it("does not swallow a positional after a boolean global flag", () => {
            expect.assertions(2);

            // `--debug` is boolean; `migrate` is the positional, not its value.
            expect(isBareMigrateInvocation(["--debug", "migrate"])).toBe(true);
            expect(isBareMigrateInvocation(["--verbose", "migrate"])).toBe(true);
        });

        it("consumes `--cwd <path>` as a flag + value pair", () => {
            expect.assertions(2);

            expect(isBareMigrateInvocation(["--cwd", "/tmp/foo", "migrate"])).toBe(true);
            expect(isBareMigrateInvocation(["migrate", "--cwd", "/tmp/foo"])).toBe(true);
        });

        it("accepts `--cwd=<path>` inline form", () => {
            expect.assertions(1);

            expect(isBareMigrateInvocation(["--cwd=/tmp/foo", "migrate"])).toBe(true);
        });

        it("does not consume the token after --cwd when it starts with `-`", () => {
            expect.assertions(1);

            // Pathological: `--cwd --debug migrate`. We don't treat --debug as
            // cwd's value — migrate remains the sole positional.
            expect(isBareMigrateInvocation(["--cwd", "--debug", "migrate"])).toBe(true);
        });
    });
});
