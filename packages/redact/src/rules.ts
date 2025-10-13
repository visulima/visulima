/**
 * Some of the rules are copied and modified from https://github.com/nitaiaharoni1/anonymize-nlp/blob/master/src/common/regexPatterns.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Nitai Aharoni
 */
import type { Rules } from "./types";

const standardModifierRules: Rules = [
    { deep: true, key: "apikey", pattern: String.raw`\b[a-zA-Z0-9]{32}\b` },
    { deep: true, key: "awsid", pattern: String.raw`\bAKIA[0-9A-Z]{16}\b` },
    { deep: true, key: "awskey", pattern: String.raw`\b[0-9a-zA-Z/+]{40}\b` },
    { deep: true, key: "bankacc", pattern: String.raw`\b\d{10,12}\b` },
    { deep: true, key: "basic_auth", pattern: String.raw`:\w+@\w+` },
    { deep: true, key: "token", pattern: String.raw`Bearer\s[0-9a-zA-Z\-_.~+/]+` },
    { deep: true, key: "crypto", pattern: String.raw`\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b` },
    { deep: true, key: "crypto", pattern: String.raw`\b0x[a-fA-F0-9]{40}\b` },
    { deep: true, key: "id", pattern: String.raw`\b\d{3}-\d{3}-\d{3}\b` },
    { deep: true, key: "creditcard", pattern: String.raw`(?:\d[ -]*?){13,16}` },
    { deep: true, key: "creditcard", pattern: String.raw`\b(?:\d[ -]*?){13,19}\b` },
    {
        deep: true,
        key: "date",
        // eslint-disable-next-line no-secrets/no-secrets
        pattern: String.raw`\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b`,
    },
    { deep: true, key: "date", pattern: String.raw`\b(0[1-9]|[12][0-9]|3[01])[- /.](0[1-9]|1[012])[- /.](19|20)\d\d\b` },
    { deep: true, key: "date", pattern: String.raw`\b\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b` },
    { deep: true, key: "date", pattern: String.raw`\b(0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])[- /.](19|20)\d\d\b` },
    {
        deep: true,
        key: "date",
        // eslint-disable-next-line no-secrets/no-secrets
        pattern: String.raw`\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}\b`,
    },
    { deep: true, key: "date", pattern: String.raw`\b(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])\b` },
    { deep: true, key: "date", pattern: String.raw`\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b` },
    { deep: true, key: "dl", pattern: String.raw`\b([A-Za-z]{1,2}\s{0,1})?\d{5,6}\b` },
    { deep: true, key: "domain", pattern: String.raw`\b((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,6}\b` },
    { deep: true, key: "id", pattern: String.raw`\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-4[A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\b` },
    { deep: true, key: "ip", pattern: String.raw`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` },
    { deep: true, key: "ip", pattern: String.raw`\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b` },
    { deep: true, key: "token", pattern: String.raw`\beyJ[0-9a-zA-Z_\-]*\.[0-9a-zA-Z_\-]*\.[0-9a-zA-Z_\-]*\b` },
    { deep: true, key: "mac_address", pattern: String.raw`\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b` },
    { deep: true, key: "id", pattern: String.raw`\b\d{9}\b` },
    { deep: true, key: "date", pattern: String.raw`\b(today|yesterday|tomorrow|last\s+night|last\s+week|next\s+week)\b` },

    {
        deep: true,
        key: "date",
        pattern: String.raw`\b(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{1,2},\s\d{4}\b`,
    },
    { deep: true, key: "phonenumber", pattern: String.raw`\+\d+\s\(\d{3}\)\s\d{3}-\d{4}` },
    { deep: true, key: "routing", pattern: String.raw`\b\d{9}\b` },
    { deep: true, key: "token", pattern: String.raw`\bxox[baprs]-[0-9a-zA-Z]{10,48}\b` },
    { deep: true, key: "ssn", pattern: String.raw`\b\d{3}-\d{2}-\d{4}\b` },
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
    { deep: true, key: "uk_nin", pattern: String.raw`\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b` },
    { deep: true, key: "url", pattern: String.raw`\b((http|https):\/\/)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)` },
    { deep: true, key: "ip", pattern: String.raw`\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b` },
    { deep: true, key: "phonenumber", pattern: String.raw`\b\(?[2-9][0-8][0-9]\)?[-. ]?[2-9][0-9]{2}[-. ]?[0-9]{4}\b` },
    { deep: true, key: "id", pattern: String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b` },
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
    { deep: true, key: "password" },
    { deep: true, key: "username" },

    { deep: true, key: "auth" },
    { deep: true, key: "bearer" },
    { deep: true, key: "credit" },
    { deep: true, key: "CVD" },
    { deep: true, key: "CVV" },
    { deep: true, key: "encrypt" },
    { deep: true, key: "PAN" },
    { deep: true, key: "pass" },
    { deep: true, key: "secret" },
];

export default standardModifierRules;
