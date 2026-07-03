import { strip } from "@visulima/colorize";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { getStatusIcon, getStatusPrefix, isCacheStatus, logCommandOutputCI } from "../../src/tui/status-utils";

describe("tui/status-utils", () => {
    describe(isCacheStatus, () => {
        it("should return true for cache statuses", () => {
            expect.assertions(3);

            expect(isCacheStatus("local-cache")).toBe(true);
            expect(isCacheStatus("local-cache-kept-existing")).toBe(true);
            expect(isCacheStatus("remote-cache")).toBe(true);
        });

        it("should return false for non-cache statuses", () => {
            expect.assertions(3);

            expect(isCacheStatus("success")).toBe(false);
            expect(isCacheStatus("failure")).toBe(false);
            expect(isCacheStatus("skipped")).toBe(false);
        });
    });

    describe(getStatusIcon, () => {
        it("should return a non-empty string for success", () => {
            expect.assertions(1);

            const icon = getStatusIcon("success");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });

        // eslint-disable-next-line vitest/prefer-expect-assertions -- type-only assertion via expectTypeOf
        it("should return a string for cache statuses", () => {
            expectTypeOf(getStatusIcon("local-cache")).toBeString();
            expectTypeOf(getStatusIcon("local-cache-kept-existing")).toBeString();
            expectTypeOf(getStatusIcon("remote-cache")).toBeString();
        });

        it("should return a string for failure", () => {
            expect.assertions(1);

            const icon = getStatusIcon("failure");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });

        it("should return a string for skipped", () => {
            expect.assertions(1);

            const icon = getStatusIcon("skipped");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });
    });

    describe(getStatusPrefix, () => {
        it("should include [cache] label for cache statuses", () => {
            expect.assertions(1);

            const prefix = strip(getStatusPrefix("local-cache"));

            expect(prefix).toContain("[cache]");
        });

        it("should include [skipped] label for skipped", () => {
            expect.assertions(1);

            const prefix = strip(getStatusPrefix("skipped"));

            expect(prefix).toContain("[skipped]");
        });

        it("should not include extra labels for plain success", () => {
            expect.assertions(2);

            const prefix = strip(getStatusPrefix("success"));

            expect(prefix).not.toContain("[cache]");
            expect(prefix).not.toContain("[skipped]");
        });
    });

    describe(logCommandOutputCI, () => {
        let writeSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        });

        afterEach(() => {
            writeSpy.mockRestore();
        });

        it("should write output to stdout", () => {
            expect.assertions(3);

            logCommandOutputCI("app:build", "success", "build output here");

            expect(writeSpy.mock.calls.length).toBeGreaterThan(0);

            const allOutput = (writeSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join("");

            expect(strip(allOutput)).toContain("app:build");
            expect(strip(allOutput)).toContain("build output here");
        });

        it("should not write anything for empty output", () => {
            expect.assertions(1);

            logCommandOutputCI("app:build", "success", "   ");

            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("should use GitHub Actions grouping when GITHUB_ACTIONS is set", () => {
            expect.assertions(2);

            const originalEnv = process.env["GITHUB_ACTIONS"];

            process.env["GITHUB_ACTIONS"] = "true";

            try {
                logCommandOutputCI("app:build", "success", "output");

                const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

                expect(allOutput).toContain("::group::");
                expect(allOutput).toContain("::endgroup::");
            } finally {
                if (originalEnv === undefined) {
                    delete process.env["GITHUB_ACTIONS"];
                } else {
                    process.env["GITHUB_ACTIONS"] = originalEnv;
                }
            }
        });
    });
});
