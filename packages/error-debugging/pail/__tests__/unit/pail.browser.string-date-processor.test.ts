import { describe, expect, it, vi } from "vitest";

import { PailBrowser } from "../../src/pail.browser";
import RawReporter from "../../src/reporter/raw/raw-reporter.browser";
import type { Meta, Processor } from "../../src/types";

/**
 * Regression test for plan 004 (pail hot-path allocations).
 *
 * The throttle check normalizes `meta.date` once via
 * `meta.date instanceof Date ? meta.date : new Date(meta.date)`.
 * `Meta.date` is typed `Date | string`, and a processor may legally replace
 * `date` with a string. This pins that the string arm still produces a valid
 * timestamp for the throttle diff so both logs are reported.
 */
describe("pailBrowserImpl string-date processor", () => {
    it("handles a processor that replaces date with a string without breaking throttle", () => {
        expect.assertions(2);

        const stringDateProcessor: Processor<string> = {
            process: (meta: Meta<string>): Meta<string> => {
                // eslint-disable-next-line no-param-reassign
                meta.date = new Date().toISOString();

                return meta;
            },
        };

        const logger = new PailBrowser({
            logLevel: "debug",
            processors: [stringDateProcessor],
            rawReporter: new RawReporter(),
            reporters: [new RawReporter()],
            scope: ["example"],
            throttle: 1000,
            throttleMin: 5,
        });

        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        logger.info("First string-date message");
        logger.info("Second string-date message");

        expect(consoleSpy).toHaveBeenCalledWith("First string-date message");
        expect(consoleSpy).toHaveBeenCalledWith("Second string-date message");

        consoleSpy.mockRestore();
    });
});
