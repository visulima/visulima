/**
 * Some of the rules are copied and modified from https://github.com/nitaiaharoni1/anonymize-nlp/blob/master/src/common/regexPatterns.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Nitai Aharoni
 */
import type { Rules } from "./types";

/* eslint-disable no-secrets/no-secrets -- regex patterns for date/time matching intentionally have high entropy */

/**
 * Credential / secret rules: API keys, AWS keys, bearer/JWT/Slack tokens, crypto wallets,
 * basic-auth strings, and the broad key-name rules (`auth`, `password`, `secret`, ...).
 *
 * These are the safest default rules — they target high-entropy or unambiguous shapes — and are
 * what most logger-scrubbing use cases need.
 */
const credentialRules: Rules = [
    { deep: true, key: "apikey", pattern: String.raw`\b[a-zA-Z0-9]{32}\b` },
    { deep: true, key: "awsid", pattern: String.raw`\bAKIA[0-9A-Z]{16}\b` },
    { deep: true, key: "awskey", pattern: String.raw`\b[0-9a-zA-Z/+]{40}\b` },
    { deep: true, key: "basic_auth", pattern: String.raw`:\w+@\w+` },
    { deep: true, key: "token", pattern: String.raw`Bearer\s[0-9a-zA-Z\-_.~+/]+` },
    { deep: true, key: "crypto", pattern: String.raw`\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b` },
    { deep: true, key: "crypto", pattern: String.raw`\b0x[a-fA-F0-9]{40}\b` },
    { deep: true, key: "token", pattern: String.raw`\beyJ[0-9a-zA-Z_\-]*\.[0-9a-zA-Z_\-]*\.[0-9a-zA-Z_\-]*\b` },
    { deep: true, key: "token", pattern: String.raw`\bxox[baprs]-[0-9a-zA-Z]{10,48}\b` },
    { deep: true, key: "auth" },
    { deep: true, key: "bearer" },
    { deep: true, key: "credit" },
    { deep: true, key: "CVD" },
    { deep: true, key: "CVV" },
    { deep: true, key: "encrypt" },
    { deep: true, key: "PAN" },
    { deep: true, key: "pass" },
    { deep: true, key: "password" },
    { deep: true, key: "secret" },
];

/**
 * Personally-identifiable-information rules: bank accounts, credit cards, IDs/UUIDs,
 * IPs, MACs, phone numbers, SSNs, NINs, ISBNs, zip codes, URLs/domains, plus the
 * NLP-powered name/organization/email/money rules.
 *
 * WARNING: several of these intentionally match plain numeric data and will overmatch on
 * ordinary values. For example `bankacc` (`\b\d{10,12}\b`), `id`/`routing` (`\b\d{9}\b`) and
 * `zip_code` (`\b[0-9]{5}\b`) will redact innocent 5/9/10-12 digit numbers. Use
 * the `exclude` option (e.g. `{ exclude: ["bankacc", "zip_code"] }`) to drop the
 * groups you do not need, or compose only the subsets you want.
 */
const piiRules: Rules = [
    { deep: true, key: "bankacc", pattern: String.raw`\b\d{10,12}\b` },
    { deep: true, key: "id", pattern: String.raw`\b\d{3}-\d{3}-\d{3}\b` },
    // Linearized credit-card pattern: the original `(?:\d[ -]*?){13,16}` combined a
    // counted group with an unbounded lazy inner quantifier, a polynomial-backtracking
    // shape (ReDoS) on attacker-influenced input. This bounded alternative matches
    // 13-19 digits optionally separated by single spaces/hyphens without nested quantifiers.
    { deep: true, key: "creditcard", pattern: String.raw`\b\d(?:[ -]?\d){12,18}\b` },
    { deep: true, key: "dl", pattern: String.raw`\b([A-Za-z]{1,2}\s{0,1})?\d{5,6}\b` },
    { deep: true, key: "domain", pattern: String.raw`\b((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,6}\b` },
    { deep: true, key: "id", pattern: String.raw`\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-4[A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b` },
    { deep: true, key: "ip", pattern: String.raw`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` },
    { deep: true, key: "ip", pattern: String.raw`\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b` },
    { deep: true, key: "mac_address", pattern: String.raw`\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b` },
    { deep: true, key: "id", pattern: String.raw`\b\d{9}\b` },
    { deep: true, key: "phonenumber", pattern: String.raw`\+\d+\s\(\d{3}\)\s\d{3}-\d{4}` },
    { deep: true, key: "routing", pattern: String.raw`\b\d{9}\b` },
    { deep: true, key: "ssn", pattern: String.raw`\b\d{3}-\d{2}-\d{4}\b` },
    { deep: true, key: "uk_nin", pattern: String.raw`\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b` },
    // Linearized url pattern: the original pre-TLD class `[-a-zA-Z0-9@:%._+~#=]{2,256}` included
    // `.`, which overlapped the following literal `\.` and produced classic polynomial backtracking.
    // Dropping `.` from that class removes the ambiguity while still matching host labels.
    {
        deep: true,
        key: "url",
        pattern: String.raw`\b((http|https):\/\/)?[-a-zA-Z0-9@:%_\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)`,
    },
    { deep: true, key: "phonenumber", pattern: String.raw`\b\(?[2-9][0-8][0-9]\)?[-. ]?[2-9][0-9]{2}[-. ]?[0-9]{4}\b` },
    { deep: true, key: "us_social_security", pattern: String.raw`\b\d{3}-\d{2}-\d{4}\b` },
    {
        deep: true,
        key: "isbn",
        pattern: String.raw`\b(?:ISBN(?:-13)?:? )?(?=[0-9]{13}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)97[89][- ]?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9]\b`,
    },
    { deep: true, key: "zip_code", pattern: String.raw`\b[0-9]{5}(?:-[0-9]{4})?\b` },
    { deep: true, key: "firstname" },
    { deep: true, key: "lastname" },
    { deep: true, key: "organization" },
    { deep: true, key: "money" },
    { deep: true, key: "bankcc" },
    { deep: true, key: "email" },
    { deep: true, key: "passport" },
    { deep: true, key: "username" },
];

/**
 * Date and time rules.
 *
 * WARNING: these match plain weekday names (`monday`, ...), relative words (`today`,
 * `yesterday`, ...) and common date/time formats, so they will mangle ordinary prose and
 * numeric data. Most logging use cases should NOT enable these. Drop them via
 * the `exclude` option or simply compose `credentialRules`/`piiRules` instead.
 */
const dateTimeRules: Rules = [
    {
        deep: true,
        key: "date",
        pattern: String.raw`\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b`,
    },
    { deep: true, key: "date", pattern: String.raw`\b(0[1-9]|[12][0-9]|3[01])[- /.](0[1-9]|1[012])[- /.](19|20)\d\d\b` },
    { deep: true, key: "date", pattern: String.raw`\b\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b` },
    { deep: true, key: "date", pattern: String.raw`\b(0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d\b` },
    {
        deep: true,
        key: "date",
        pattern: String.raw`\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b`,
    },
    { deep: true, key: "date", pattern: String.raw`\b(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])\b` },
    { deep: true, key: "date", pattern: String.raw`\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b` },
    { deep: true, key: "date", pattern: String.raw`\b(today|yesterday|tomorrow|last\s+night|last\s+week|next\s+week)\b` },
    {
        deep: true,
        key: "date",
        pattern: String.raw`\b(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},\s\d{4}\b`,
    },
    { deep: true, key: "time", pattern: String.raw`\b(1[012]|[1-9]):[0-5][0-9](\s)?(am|pm)\b` },
    { deep: true, key: "time", pattern: String.raw`\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b` },
    { deep: true, key: "time", pattern: String.raw`\b([01][0-9]|1[0-2]):[0-5][0-9]:[0-5][0-9](\s)?(am|pm)\b` },
    { deep: true, key: "time", pattern: String.raw`\b([01]?[0-9]|1[0-2])\s?(am|pm)\b` },
    { deep: true, key: "time", pattern: String.raw`\b([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\b` },
    {
        deep: true,
        key: "time",
        pattern: String.raw`\b\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.\d{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])\b`,
    },
];

/* eslint-enable no-secrets/no-secrets */

/**
 * The default rule set, aggregating {@link credentialRules}, {@link piiRules} and
 * {@link dateTimeRules}.
 *
 * Note: this set is intentionally aggressive and several rules overmatch ordinary numeric
 * and prose data (see the warnings on {@link piiRules} and {@link dateTimeRules}). For most
 * use cases prefer composing only the themed subsets you need, e.g.
 * `redact(input, [...credentialRules, ...piiRules])`, or use `exclude` to drop noisy groups.
 */
const standardModifierRules: Rules = [...credentialRules, ...piiRules, ...dateTimeRules];

export { credentialRules, dateTimeRules, piiRules };

export default standardModifierRules;
