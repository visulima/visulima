import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("is-in-ci"), () => {
    return { default: false };
});

const { showSponsorNotice } = await import("../../src/util/sponsor");

describe("showSponsorNotice", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let originalIsTty: boolean | undefined;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        originalIsTty = process.stderr.isTTY;
        delete process.env.VIS_CLI_TEST;
        delete process.env.VIS_NO_SPONSOR;
    });

    afterEach(() => {
        stderrSpy.mockRestore();
        process.stderr.isTTY = originalIsTty;
    });

    it("should not show notice when command failed", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        showSponsorNotice({ success: false });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show notice when VIS_CLI_TEST is set", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        process.env.VIS_CLI_TEST = "1";
        showSponsorNotice({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show notice when VIS_NO_SPONSOR=1 is set", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        process.env.VIS_NO_SPONSOR = "1";
        showSponsorNotice({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show notice when sponsor.enabled is false in visConfig", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        showSponsorNotice({ success: true, visConfig: { sponsor: { enabled: false } } });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show notice on non-TTY stderr", () => {
        expect.assertions(1);

        process.stderr.isTTY = false;
        showSponsorNotice({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show notice when CI is set", async () => {
        expect.assertions(1);

        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: true };
        });
        const { showSponsorNotice: showCi } = await import("../../src/util/sponsor");

        process.stderr.isTTY = true;
        showCi({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();

        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: false };
        });
    });
});
