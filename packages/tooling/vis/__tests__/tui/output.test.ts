import { strip } from "@visulima/colorize";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { getStatusIcon, getStatusPrefix, isCacheStatus, logCommandOutputCI } from "../../src/tui/status-utils";

describe("tui/status-utils", () => {
    describe(isCacheStatus, () => {
        it("should return true for cache statuses", () => {
            expect(isCacheStatus("local-cache")).toBe(true);
            expect(isCacheStatus("local-cache-kept-existing")).toBe(true);
            expect(isCacheStatus("remote-cache")).toBe(true);
        });

        it("should return false for non-cache statuses", () => {
            expect(isCacheStatus("success")).toBe(false);
            expect(isCacheStatus("failure")).toBe(false);
            expect(isCacheStatus("skipped")).toBe(false);
        });
    });

    describe(getStatusIcon, () => {
        it("should return a non-empty string for success", () => {
            const icon = getStatusIcon("success");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });

        it("should return a string for cache statuses", () => {
            expectTypeOf(getStatusIcon("local-cache")).toBeString();
            expectTypeOf(getStatusIcon("local-cache-kept-existing")).toBeString();
            expectTypeOf(getStatusIcon("remote-cache")).toBeString();
        });

        it("should return a string for failure", () => {
            const icon = getStatusIcon("failure");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });

        it("should return a string for skipped", () => {
            const icon = getStatusIcon("skipped");

            expectTypeOf(icon).toBeString();

            expect(strip(icon).length).toBeGreaterThan(0);
        });
    });

    describe(getStatusPrefix, () => {
        it("should include [cache] label for cache statuses", () => {
            const prefix = strip(getStatusPrefix("local-cache"));

            expect(prefix).toContain("[cache]");
        });

        it("should include [skipped] label for skipped", () => {
            const prefix = strip(getStatusPrefix("skipped"));

            expect(prefix).toContain("[skipped]");
        });

        it("should not include extra labels for plain success", () => {
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
            logCommandOutputCI("app:build", "success", "build output here");

            expect(writeSpy).toHaveBeenCalledWith();

            const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

            expect(strip(allOutput)).toContain("app:build");
            expect(strip(allOutput)).toContain("build output here");
        });

        it("should not write anything for empty output", () => {
            logCommandOutputCI("app:build", "success", "   ");

            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("should use GitHub Actions grouping when GITHUB_ACTIONS is set", () => {
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
