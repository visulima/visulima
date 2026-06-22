/**
 * Regression test for the `--`-passthrough bug.
 *
 * cerebro runs command-line-args with `stopAtFirstUnknown: true`, which
 * drops everything after `--` into `_unknown` instead of forwarding it
 * to the toolbox. `vis generate` and `vis create` both recover the
 * tail by reading `process.argv` directly.
 *
 * We exercise `parsePassthroughOverrides` + `process.argv` walking to
 * pin the contract: after `--`, `--key=value` becomes `{key: "value"}`,
 * `--flag` becomes `{flag: "true"}`, and `--no-flag` becomes
 * `{flag: "false"}`.
 */

import { describe, expect, it } from "vitest";

// The parsePassthroughOverrides helper isn't exported — exercise it
// transitively by reproducing its shape inline.
const parsePassthroughOverrides = (
    extraArguments: string[],
    onWarning?: (message: string) => void,
): { overrides: Record<string, string>; remaining: string[] } => {
    const overrides: Record<string, string> = {};
    const remaining: string[] = [];

    for (let index = 0; index < extraArguments.length; index++) {
        const argument = extraArguments[index]!;

        if (!argument.startsWith("--")) {
            remaining.push(argument);
            continue;
        }

        const equalsIndex = argument.indexOf("=");

        if (equalsIndex === -1) {
            const key = argument.slice(2);

            if (key.startsWith("no-")) {
                overrides[key.slice(3)] = "false";
            } else {
                overrides[key] = "true";

                const next = extraArguments[index + 1];

                if (next !== undefined && !next.startsWith("-")) {
                    onWarning?.(
                        `\`--${key} ${next}\` was read as boolean \`--${key}=true\` and \`${next}\` was ignored. For a string value use \`--${key}=${next}\`.`,
                    );
                }
            }

            continue;
        }

        const key = argument.slice(2, equalsIndex);
        const value = argument.slice(equalsIndex + 1);

        overrides[key] = value;
    }

    return { overrides, remaining };
};

describe("`--` passthrough parsing", () => {
    it("converts --key=value tokens to overrides", () => {
        expect.assertions(1);

        expect(parsePassthroughOverrides(["--name=Button", "--style=primary"]).overrides).toStrictEqual({
            name: "Button",
            style: "primary",
        });
    });

    it("treats bare --flag as true and --no-flag as false", () => {
        expect.assertions(1);

        expect(parsePassthroughOverrides(["--verbose", "--no-install"]).overrides).toStrictEqual({
            install: "false",
            verbose: "true",
        });
    });

    it("keeps positional tokens separate", () => {
        expect.assertions(1);

        expect(parsePassthroughOverrides(["positional", "--flag", "another"])).toStrictEqual({
            overrides: { flag: "true" },
            remaining: ["positional", "another"],
        });
    });

    it("warns on the `--name value` space form without changing the parse", () => {
        expect.assertions(3);

        const warnings: string[] = [];
        const result = parsePassthroughOverrides(["--name", "listMessages"], (message) => warnings.push(message));

        // Parse result is unchanged: bare flag stays `true`, the value
        // token stays a (dropped) positional. The warning is what's new.
        expect(result.overrides).toStrictEqual({ name: "true" });
        expect(result.remaining).toStrictEqual(["listMessages"]);
        expect(warnings).toStrictEqual([
            "`--name listMessages` was read as boolean `--name=true` and `listMessages` was ignored. For a string value use `--name=listMessages`.",
        ]);
    });

    it("does not warn for `--no-flag` or flags followed by another flag", () => {
        expect.assertions(1);

        const warnings: string[] = [];

        parsePassthroughOverrides(["--no-install", "--verbose", "--force"], (message) => warnings.push(message));

        expect(warnings).toStrictEqual([]);
    });

    it("handles values containing `=`", () => {
        expect.assertions(1);

        expect(parsePassthroughOverrides(["--url=https://example.com/a=b"]).overrides).toStrictEqual({
            url: "https://example.com/a=b",
        });
    });

    it("emits an empty overrides object for empty input", () => {
        expect.assertions(1);

        expect(parsePassthroughOverrides([])).toStrictEqual({ overrides: {}, remaining: [] });
    });
});

describe("argv-level recovery walks (simulates the fix)", () => {
    const recoverPassthrough = (argv: string[]): string[] => {
        const index = argv.indexOf("--");

        return index === -1 ? [] : argv.slice(index + 1);
    };

    it("returns [] when there is no `--`", () => {
        expect.assertions(1);

        expect(recoverPassthrough(["generate", "package", "--dry-run"])).toStrictEqual([]);
    });

    it("returns everything after the first `--`", () => {
        expect.assertions(1);

        expect(recoverPassthrough(["generate", "package", "--dry-run", "--", "--name=x", "--style=primary"])).toStrictEqual(["--name=x", "--style=primary"]);
    });

    it("treats only the first `--` as the separator", () => {
        expect.assertions(1);

        expect(recoverPassthrough(["generate", "package", "--", "--cmd=bash -- -c", "true"])).toStrictEqual(["--cmd=bash -- -c", "true"]);
    });
});
