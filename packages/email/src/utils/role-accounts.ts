/**
 * Common role account prefixes that indicate non-personal email addresses.
 */
const ROLE_ACCOUNT_PREFIXES: Set<string> = new Set<string>([
    "abuse",
    "admin",
    "administrator",
    "billing",
    "contact",
    "help",
    "info",
    "mail",
    "mailer-daemon",
    "marketing",
    "newsletter",
    "no-reply",
    "noreply",
    "postmaster",
    "privacy",
    "sales",
    "security",
    "support",
    "team",
    "webmaster",
]);

const checkRolePrefix = (prefix: string, customPrefixes?: Set<string>): boolean => ROLE_ACCOUNT_PREFIXES.has(prefix) || (customPrefixes?.has(prefix) ?? false);

const checkCombinedParts = (parts: string[], customPrefixes?: Set<string>): boolean => {
    if (parts.length < 2) {
        return false;
    }

    const separators = ["-", ".", "_"];

    for (const separator of separators) {
        const combined = `${parts[0]}${separator}${parts[1]}`;

        if (checkRolePrefix(combined, customPrefixes)) {
            return true;
        }
    }

    return false;
};

const checkAllPartsAreRoleAccounts = (parts: string[], customPrefixes?: Set<string>): boolean => {
    for (const part of parts) {
        if (!checkRolePrefix(part, customPrefixes)) {
            return false;
        }
    }

    return true;
};

/**
 * Checks if an email address is a role account (non-personal).
 * @param email The email address to check.
 * @param customPrefixes Optional set of additional role account prefixes.
 * @returns True if the email is a role account, false otherwise.
 * @example
 * ```ts
 * import { isRoleAccount } from "@visulima/email/utils/role-accounts";
 *
 * if (isRoleAccount("noreply@example.com")) {
 *     console.log("This is a role account");
 * }
 * ```
 */
export const isRoleAccount = (email: string, customPrefixes?: Set<string>): boolean => {
    if (!email || typeof email !== "string") {
        return false;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const atIndex = normalizedEmail.indexOf("@");

    if (atIndex === -1 || atIndex === 0) {
        return false;
    }

    const localPart = normalizedEmail.slice(0, atIndex);

    if (checkRolePrefix(localPart, customPrefixes)) {
        return true;
    }

    const parts = localPart.split(/[+._-]/);

    if (parts.length === 1) {
        const firstPart = parts[0];

        if (firstPart === undefined) {
            return false;
        }

        return checkRolePrefix(firstPart, customPrefixes);
    }

    if (checkCombinedParts(parts, customPrefixes)) {
        return true;
    }

    return checkAllPartsAreRoleAccounts(parts, customPrefixes);
};

export { ROLE_ACCOUNT_PREFIXES };
