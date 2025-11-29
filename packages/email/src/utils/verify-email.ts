import checkMxRecords from "./check-mx-records";
import isDisposableEmail from "./is-disposable-email";
import { isRoleAccount } from "./role-accounts";
import validateEmail from "./validate-email";
import type { SmtpVerificationOptions } from "./verify-smtp";
import verifySmtp from "./verify-smtp";

/**
 * Options for comprehensive email verification.
 */
interface EmailVerificationOptions extends SmtpVerificationOptions {
    checkDisposable?: boolean;
    checkMx?: boolean;
    checkRoleAccount?: boolean;
    checkSmtp?: boolean;
    customDisposableDomains?: Set<string>;
    customRolePrefixes?: Set<string>;
}

/**
 * Result of comprehensive email verification.
 */
interface EmailVerificationResult {
    disposable?: boolean;
    errors: string[];
    formatValid: boolean;
    mxValid?: boolean;
    roleAccount?: boolean;
    smtpValid?: boolean;
    valid: boolean;
    warnings: string[];
}

/**
 * Comprehensive email verification combining multiple checks.
 * @param email The email address to verify.
 * @param options Verification options.
 * @returns Detailed verification result.
 * @example
 * ```ts
 * import { verifyEmail } from "@visulima/email/utils/verify-email";
 *
 * const result = await verifyEmail("user@example.com", {
 *     checkDisposable: true,
 *     checkRoleAccount: true,
 *     checkMx: true,
 *     checkSmtp: false
 * });
 *
 * if (result.valid) {
 *     console.log("Email is valid!");
 * }
 * ```
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const verifyEmail = async (email: string, options: EmailVerificationOptions = {}): Promise<EmailVerificationResult> => {
    const {
        checkDisposable = true,
        checkMx = true,
        checkRoleAccount = true,
        checkSmtp = false,
        customDisposableDomains,
        customRolePrefixes,
        ...smtpOptions
    } = options;

    const formatValid = validateEmail(email);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!formatValid) {
        errors.push("Invalid email format");

        return {
            errors,
            formatValid: false,
            valid: false,
            warnings,
        };
    }

    let disposable: boolean | undefined;
    let roleAccount: boolean | undefined;
    let mxValid: boolean | undefined;
    let smtpValid: boolean | undefined;

    if (checkDisposable) {
        try {
            disposable = isDisposableEmail(email, customDisposableDomains);

            if (disposable) {
                warnings.push("Email is from a disposable email service");
            }
        } catch {
            // disposable-domains not installed, skip check
        }
    }

    if (checkRoleAccount) {
        roleAccount = isRoleAccount(email, customRolePrefixes);

        if (roleAccount) {
            warnings.push("Email appears to be a role account (non-personal)");
        }
    }

    if (checkMx) {
        const domain = email.split("@")[1];
        const mxCheck = await checkMxRecords(domain);

        mxValid = mxCheck.valid;

        if (!mxCheck.valid) {
            errors.push(mxCheck.error || "No valid MX records found");
        }
    }

    if (checkSmtp) {
        const smtpCheck = await verifySmtp(email, smtpOptions);

        smtpValid = smtpCheck.valid;

        if (!smtpCheck.valid && smtpCheck.error) {
            errors.push(`SMTP verification failed: ${smtpCheck.error}`);
        }
    }

    const valid = formatValid && errors.length === 0;

    return {
        disposable,
        errors,
        formatValid,
        mxValid,
        roleAccount,
        smtpValid,
        valid,
        warnings,
    };
};

export default verifyEmail;
export type { EmailVerificationOptions, EmailVerificationResult };
