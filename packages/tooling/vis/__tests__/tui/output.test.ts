import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { strip } from "@visulima/colorize";

import { CLIOutput } from "../../src/tui/output";

describe("tui/CLIOutput", () => {
    let output: CLIOutput;
    let writeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        output = new CLIOutput();
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        writeSpy.mockRestore();
    });

    describe("formatCommand", () => {
        it("should format a task command string", () => {
            const result = strip(output.formatCommand("my-app:build"));

            expect(result).toContain("vis run ");
            expect(result).toContain("my-app:build");
        });
    });

    describe("getSeparator", () => {
        it("should return a separator string", () => {
            const sep = strip(output.getSeparator());

            expect(sep.length).toBeGreaterThan(0);
        });
    });

    describe("applyPrefix", () => {
        it("should wrap text with VIS prefix", () => {
            const result = strip(output.applyPrefix((t: string) => t, "hello"));

            expect(result).toContain("VIS");
            expect(result).toContain("hello");
        });
    });

    describe("getStatusIcon", () => {
        it("should return green icon for success", () => {
            const icon = output.getStatusIcon("success");

            expect(icon).toBeTruthy();
        });

        it("should return green icon for cache statuses", () => {
            expect(output.getStatusIcon("local-cache")).toBeTruthy();
            expect(output.getStatusIcon("local-cache-kept-existing")).toBeTruthy();
            expect(output.getStatusIcon("remote-cache")).toBeTruthy();
        });

        it("should return red icon for failure", () => {
            const icon = output.getStatusIcon("failure");

            expect(icon).toBeTruthy();
        });

        it("should return dim icon for skipped", () => {
            const icon = output.getStatusIcon("skipped");

            expect(icon).toBeTruthy();
        });
    });

    describe("getStatusPrefix", () => {
        it("should include [cache] label for cache statuses", () => {
            const prefix = strip(output.getStatusPrefix("local-cache"));

            expect(prefix).toContain("[cache]");
        });

        it("should include [skipped] label for skipped", () => {
            const prefix = strip(output.getStatusPrefix("skipped"));

            expect(prefix).toContain("[skipped]");
        });

        it("should not include extra labels for plain success", () => {
            const prefix = strip(output.getStatusPrefix("success"));

            expect(prefix).not.toContain("[cache]");
            expect(prefix).not.toContain("[skipped]");
        });
    });

    describe("success", () => {
        it("should return success message with VIS prefix", () => {
            const result = strip(output.success("All good"));

            expect(result).toContain("VIS");
            expect(result).toContain("All good");
        });

        it("should include body lines when provided", () => {
            const result = strip(output.success("Title", ["line1", "line2"]));

            expect(result).toContain("line1");
            expect(result).toContain("line2");
        });
    });

    describe("error", () => {
        it("should return error message with VIS prefix", () => {
            const result = strip(output.error("Something failed"));

            expect(result).toContain("VIS");
            expect(result).toContain("Something failed");
        });

        it("should include body lines when provided", () => {
            const result = strip(output.error("Title", ["detail1"]));

            expect(result).toContain("detail1");
        });
    });

    describe("logCommandOutput", () => {
        it("should write output to stdout", () => {
            output.logCommandOutput("app:build", "success", "build output here");

            expect(writeSpy).toHaveBeenCalled();

            const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

            expect(strip(allOutput)).toContain("app:build");
            expect(strip(allOutput)).toContain("build output here");
        });

        it("should not write anything for empty output", () => {
            output.logCommandOutput("app:build", "success", "   ");

            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("should use GitHub Actions grouping when GITHUB_ACTIONS is set", () => {
            const originalEnv = process.env["GITHUB_ACTIONS"];

            process.env["GITHUB_ACTIONS"] = "true";

            try {
                output.logCommandOutput("app:build", "success", "output");

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

    describe("overwriteLines", () => {
        it("should write lines to stdout", () => {
            output.overwriteLines(0, ["line1", "line2"]);

            expect(writeSpy).toHaveBeenCalled();

            const allOutput = writeSpy.mock.calls.map((c) => String(c[0])).join("");

            expect(allOutput).toContain("line1");
            expect(allOutput).toContain("line2");
        });

        it("should erase previous lines when numLines > 0", () => {
            output.overwriteLines(3, ["new line"]);

            // Should have written erase sequences + new content
            expect(writeSpy).toHaveBeenCalled();
        });
    });
});
