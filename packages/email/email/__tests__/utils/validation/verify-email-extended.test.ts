import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkMxRecords } from "../../../src/utils/validation/check-mx-records";
import validateEmail from "../../../src/utils/validation/validate-email";
import { verifyEmail } from "../../../src/utils/validation/verify-email";
import { verifySmtp } from "../../../src/utils/validation/verify-smtp";

vi.mock(import("../../../src/utils/validation/validate-email"), () => {
    return {
        default: vi.fn(),
    };
});

vi.mock(import("../../../src/utils/validation/check-mx-records"), () => {
    return {
        checkMxRecords: vi.fn(),
    };
});

vi.mock(import("../../../src/utils/validation/verify-smtp"), () => {
    return {
        verifySmtp: vi.fn(),
    };
});

const validateEmailMock = validateEmail as ReturnType<typeof vi.fn>;
const checkMxRecordsMock = checkMxRecords as ReturnType<typeof vi.fn>;
const verifySmtpMock = verifySmtp as ReturnType<typeof vi.fn>;

const noNetworkChecks = { checkDisposable: false, checkMx: false, checkRoleAccount: false, checkSmtp: false } as const;

describe("verifyEmail (extended)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateEmailMock.mockReturnValue(true);
    });

    it("pushes a missing-domain error when the address has no domain", async () => {
        expect.assertions(3);

        const result = await verifyEmail("user@", { ...noNetworkChecks, checkMx: true });

        expect(result.valid).toBe(false);
        expect(result.mxValid).toBe(false);
        expect(result.errors).toContain("Invalid email format: missing domain");
    });

    it("records the MX error message when the lookup fails", async () => {
        expect.assertions(3);

        checkMxRecordsMock.mockResolvedValue({ error: "bad mx", valid: false });

        const result = await verifyEmail("user@example.com", { ...noNetworkChecks, checkMx: true });

        expect(result.mxValid).toBe(false);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("bad mx");
    });

    it("uses a default MX error message when none is provided", async () => {
        expect.assertions(1);

        checkMxRecordsMock.mockResolvedValue({ valid: false });

        const result = await verifyEmail("user@example.com", { ...noNetworkChecks, checkMx: true });

        expect(result.errors).toContain("No valid MX records found");
    });

    it("records an SMTP failure with its error message", async () => {
        expect.assertions(3);

        verifySmtpMock.mockResolvedValue({ error: "blocked", valid: false });

        const result = await verifyEmail("user@example.com", { ...noNetworkChecks, checkSmtp: true });

        expect(result.smtpValid).toBe(false);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("SMTP verification failed: blocked");
    });

    it("marks SMTP as valid when verification passes", async () => {
        expect.assertions(2);

        verifySmtpMock.mockResolvedValue({ valid: true });

        const result = await verifyEmail("user@example.com", { ...noNetworkChecks, checkSmtp: true });

        expect(result.smtpValid).toBe(true);
        expect(result.valid).toBe(true);
    });

    it("ignores an SMTP failure that carries no error message", async () => {
        expect.assertions(2);

        verifySmtpMock.mockResolvedValue({ valid: false });

        const result = await verifyEmail("user@example.com", { ...noNetworkChecks, checkSmtp: true });

        expect(result.smtpValid).toBe(false);
        expect(result.errors).toHaveLength(0);
    });
});
