/**
 * Common role account prefixes that indicate non-personal email addresses.
 * Includes RFC 2142 standard role accounts and common business/operational prefixes.
 */
const ROLE_ACCOUNT_PREFIXES: Set<string> = new Set<string>([
    "abuse",
    "accounts",
    "admin",
    "adminhelp",
    "administrator",
    "adminoffice",
    "adminteam",
    "affiliates",
    "alarms",
    "alert",
    "alternative",
    "analytics",
    "anonymous",
    "archive",
    "audit",
    "automated",
    "autoreply",
    "backoffice",
    "backup",
    "batch",
    "billing",
    "board",
    "bot",
    "bounce",
    "bug",
    "bugreport",
    "build",
    "careers",
    "cert",
    "chapter",
    "chatbot",
    "ci",
    "compliance",
    "contact",
    "continuousintegration",
    "cron",
    "csirt",
    "customer-care",
    "customercare",
    "customerservice",
    "customersupport",
    "cvs",
    "daemon",
    "default",
    "demo",
    "deploy",
    "deployment",
    "dev",
    "development",
    "devops",
    "digest",
    "director",
    "dnsadmin",
    "docs",
    "donotreply",
    "enquiry",
    "errors",
    "events",
    "executive",
    "faculty",
    "failover",
    "feed",
    "feedback",
    "finance",
    "forensics",
    "ftp",
    "git",
    "guardian",
    "guest",
    "help",
    "helpdesk",
    "helpsec",
    "hostmaster",
    "hr",
    "incident",
    "incidents",
    "indexer",
    "info",
    "ingest",
    "inquiry",
    "issues",
    "it",
    "jobs",
    "legal",
    "list",
    "list-request",
    "log",
    "logistics",
    "logs",
    "maildaemon",
    "mailer-daemon",
    "malicious",
    "management",
    "manager",
    "marketing",
    "media",
    "membership",
    "metrics",
    "mod",
    "moderator",
    "mods",
    "monitor",
    "network",
    "news",
    "newsletter",
    "no-reply",
    "noc",
    "noreply",
    "notifications",
    "notify",
    "operations",
    "operator",
    "owner",
    "owners",
    "parent",
    "partners",
    "patches",
    "payments",
    "phish",
    "phishing",
    "pipeline",
    "post",
    "postmaster",
    "pr",
    "press",
    "privacy",
    "procurement",
    "qa",
    "recruitment",
    "redundancy",
    "registrar",
    "releases",
    "reminder",
    "reminders",
    "reply",
    "report",
    "reports",
    "request",
    "resource",
    "root",
    "sales",
    "scheduler",
    "secondary",
    "secops",
    "secretariat",
    "secretary",
    "security",
    "server",
    "service",
    "spam",
    "spamreport",
    "staff",
    "standby",
    "student",
    "subscribe",
    "subscriptions",
    "summaries",
    "supervisor",
    "supplychain",
    "support",
    "supportteam",
    "svn",
    "sync",
    "sysadmin",
    "system",
    "system-alert",
    "system-msg",
    "team",
    "tech",
    "techsupport",
    "temp",
    "tertiary",
    "test",
    "threat",
    "threats",
    "tracker",
    "trial",
    "unknown",
    "unsubscribe",
    "update",
    "updates",
    "usenet",
    "usergroup",
    "uucp",
    "volunteer",
    "vuln",
    "vulnerability",
    "webinars",
    "webmaster",
    "www",
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
 * import { isRoleAccount } from "@visulima/email/validation/role-accounts";
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
