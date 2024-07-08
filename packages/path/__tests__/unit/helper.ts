/**
 * A modified version of "runTest" from `https://github.com/unjs/pathe/blob/main/test/index.spec.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa <pooya@pi0.io> - Daniel Roe <daniel@roe.dev>
 */
import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _r = (item: boolean | string | (() => string) | null | undefined): boolean | string | null | undefined => (typeof item === "function" ? item() : item);
// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const _s = (item: boolean | string | (() => string) | null | undefined): string => (JSON.stringify(_r(item)) || "undefined").replaceAll('"', "'");

const runTest = (
    name: string,
    function_: (...parameters: string[]) => boolean | string,
    items: (boolean | string | (() => string) | null | undefined)[][] | Record<string, boolean | string>,
): void => {
    if (!Array.isArray(items)) {
        // eslint-disable-next-line no-param-reassign
        items = Object.entries(items).map((entry) => entry.flat());
    }

    describe(name, () => {
        let cwd;

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,vitest/prefer-each
        for (const item of items) {
            const expected = item.pop();
            // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
            const arguments_ = item;

            it(`${name}(${arguments_.map((index) => _s(index)).join(",")}) should be ${_s(expected as boolean | string)}`, () => {
                expect.assertions(1);

                // @ts-expect-error - TODO: fix typing
                expect(function_(...arguments_.map((index) => _r(index)))).toStrictEqual(_r(expected as boolean | string));
            });

            // eslint-disable-next-line @typescript-eslint/no-loop-func
            it(`${name}(${arguments_.map((index) => _s(index)).join(",")}) should be ${_s(expected as boolean | string)} on Windows`, () => {
                expect.assertions(1);

                // eslint-disable-next-line @typescript-eslint/unbound-method
                cwd = process.cwd;

                vi.spyOn(process, "cwd").mockImplementation(() => "C:\\Windows\\path\\only");

                // @ts-expect-error - TODO: fix typing
                expect(function_(...arguments_.map((index) => _r(index)))).toStrictEqual(_r(expected as boolean | string));

                process.cwd = cwd;
            });
        }
    });
};

export default runTest;
