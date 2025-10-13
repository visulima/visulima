import { execSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

type ItemValue = boolean | string | (() => string) | null | undefined;

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle, @stylistic/no-extra-parens
const _r = (item: ItemValue): boolean | string | null | undefined => (typeof item === "function" ? item() : item);
// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _s = (item: ItemValue): string => (JSON.stringify(_r(item)) || "undefined").replaceAll("\"", "'");

/**
 * Return output of javascript file.
 */

export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node "${file}" ${flags.join(" ")}`;
    // eslint-disable-next-line sonarjs/os-command
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};

/**
 * A modified version of "runTest" from `https://github.com/unjs/pathe/blob/main/test/index.spec.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa &lt;pooya@pi0.io> - Daniel Roe &lt;daniel@roe.dev>
 */

export const runTest = (
    name: string,
    function_: (...parameters: string[]) => boolean | string,
    items: ItemValue[][] | Record<string, boolean | string>,
): void => {
    if (!Array.isArray(items)) {
        // eslint-disable-next-line no-param-reassign
        items = Object.entries(items).map((entry) => entry.flat());
    }

    describe(name, () => {
        let cwd;

        // eslint-disable-next-line vitest/prefer-each
        for (const item of items) {
            const expected = item.pop();
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const arguments_ = item;

            it(`${name}(${arguments_.map((index) => _s(index)).join(",")}) should be ${_s(expected as boolean | string)}`, () => {
                expect.assertions(1);

                // @ts-expect-error - TODO: fix typing
                expect(function_(...arguments_.map((index) => _r(index)))).toStrictEqual(_r(expected as boolean | string));
            });

            it(`${name}(${arguments_.map((index) => _s(index)).join(",")}) should be ${_s(expected as boolean | string)} on Windows`, () => {
                expect.assertions(1);

                cwd = process.cwd;

                vi.spyOn(process, "cwd").mockImplementation(() => String.raw`C:\Windows\path\only`);

                // @ts-expect-error - TODO: fix typing
                expect(function_(...arguments_.map((index) => _r(index)))).toStrictEqual(_r(expected as boolean | string));

                process.cwd = cwd;
            });
        }
    });
};
