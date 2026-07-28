import { splitAddress } from "../internal/address";

/**
 * Local-part prefixes that indicate a no-reply / do-not-reply mailbox.
 * These are a strict subset of {@link ROLE_ACCOUNT_PREFIXES}.
 */
const NO_REPLY_PREFIXES: ReadonlySet<string> = new Set([
    "do-not-reply",
    "do_not_reply",
    "donotreply",
    "no-reply",
    "no_reply",
    "noreply",
    "notification",
    "notifications",
    "notify",
]);

/**
 * Local-part prefixes that identify a role-based (shared, function) mailbox
 * rather than a personal one. Superset of RFC 2142 plus common real-world roles.
 */
const ROLE_ACCOUNT_PREFIXES: ReadonlySet<string> = new Set([
    "abuse",
    "accounting",
    "accounts",
    "admin",
    "administrator",
    "all",
    "billing",
    "board",
    "career",
    "careers",
    "ceo",
    "cfo",
    "compliance",
    "contact",
    "contacts",
    "cto",
    "customercare",
    "customerservice",
    "dev",
    "developer",
    "devnull",
    "do-not-reply",
    "do_not_reply",
    "donotreply",
    "enquiries",
    "enquiry",
    "everyone",
    "feedback",
    "finance",
    "ftp",
    "hello",
    "help",
    "helpdesk",
    "hi",
    "hostmaster",
    "hr",
    "info",
    "information",
    "inquiries",
    "inquiry",
    "investor",
    "investors",
    "it",
    "jobs",
    "legal",
    "list",
    "list-request",
    "mail",
    "mailer-daemon",
    "mailerdaemon",
    "majordomo",
    "marketing",
    "media",
    "members",
    "newsletter",
    "no-reply",
    "no_reply",
    "noc",
    "noreply",
    "notification",
    "notifications",
    "notify",
    "office",
    "operations",
    "order",
    "orders",
    "postmaster",
    "press",
    "privacy",
    "purchasing",
    "recruitment",
    "register",
    "registration",
    "root",
    "sales",
    "secretary",
    "security",
    "service",
    "services",
    "shop",
    "spam",
    "staff",
    "subscribe",
    "support",
    "sysadmin",
    "team",
    "tech",
    "test",
    "unsubscribe",
    "usenet",
    "uucp",
    "webmaster",
    "welcome",
    "www",
]);

/**
 * Splitters used to break a local part into sub-tokens
 * (e.g. `sales.team`, `info_desk`, `no-reply`).
 */
const PART_SPLIT_REGEX = /[.\-_+]/;

const isRolePrefix = (localPart: string, prefixes: ReadonlySet<string>, customPrefixes?: ReadonlySet<string>): boolean =>
    prefixes.has(localPart) || (customPrefixes?.has(localPart) ?? false);

/**
 * Determines whether an email address is a role-based account.
 *
 * Matches the whole local part, the part before any `+tag`, and each
 * dot/dash/underscore-separated token (so `sales.john`, `info+news`, and
 * `no-reply` are all caught).
 * @param email The email address to check.
 * @param customPrefixes Optional additional role prefixes to recognize.
 * @returns True when the address is a role account.
 * @example
 * ```ts
 * import { isRoleAccount } from "@visulima/email-verifier/checks/role";
 *
 * isRoleAccount("info@example.com"); // true
 * isRoleAccount("john.doe@example.com"); // false
 * ```
 */
const isRoleAccount = (email: string, customPrefixes?: Iterable<string>): boolean => {
    const parts = splitAddress(email);

    if (!parts) {
        return false;
    }

    const { localPart } = parts;
    const beforeTag = localPart.split("+")[0] as string;
    // Materialize the caller's iterable once — a single-pass iterable (generator,
    // Map.keys()) would otherwise be exhausted by the first isRolePrefix call and
    // silently ignored by the beforeTag and per-token checks below. Lowercasing
    // here also turns each membership test into an O(1) Set lookup.
    const customSet = customPrefixes ? new Set([...customPrefixes].map((prefix) => prefix.toLowerCase())) : undefined;

    if (isRolePrefix(localPart, ROLE_ACCOUNT_PREFIXES, customSet) || isRolePrefix(beforeTag, ROLE_ACCOUNT_PREFIXES, customSet)) {
        return true;
    }

    const tokens = beforeTag.split(PART_SPLIT_REGEX).filter(Boolean);

    // Treat the local part as a role account when *any* dot/dash/underscore token
    // is a role word (e.g. `sales.john`, `sales-team`), matching the documented
    // behaviour. A purely personal local part like `john.doe` has no role token
    // and so is not flagged.
    return tokens.length > 1 && tokens.some((token) => isRolePrefix(token, ROLE_ACCOUNT_PREFIXES, customSet));
};

/**
 * Determines whether an email address is a no-reply / do-not-reply mailbox.
 * @param email The email address to check.
 * @returns True when the address is a no-reply mailbox.
 * @example
 * ```ts
 * import { isNoReply } from "@visulima/email-verifier/checks/role";
 *
 * isNoReply("no-reply@example.com"); // true
 * ```
 */
const isNoReply = (email: string): boolean => {
    const parts = splitAddress(email);

    if (!parts) {
        return false;
    }

    const beforeTag = parts.localPart.split("+")[0] as string;

    return isRolePrefix(parts.localPart, NO_REPLY_PREFIXES) || isRolePrefix(beforeTag, NO_REPLY_PREFIXES);
};

export { isNoReply, isRoleAccount, NO_REPLY_PREFIXES, ROLE_ACCOUNT_PREFIXES };
export default isRoleAccount;
