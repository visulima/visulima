 export const regexPatterns = [
    { key: "apikey", regex: "\\b[a-zA-Z0-9]{32}\\b" },
    { key: "awsid", regex: "\\bAKIA[0-9A-Z]{16}\\b" },
    { key: "awskey", regex: "\\b[0-9a-zA-Z/+]{40}\\b" },
    { key: "bankacc", regex: "\\b\\d{10,12}\\b" },
    { key: "basic_auth", regex: ":\\w+@\\w+" },
    { key: "token", regex: "Bearer\\s[0-9a-zA-Z\\-_.~+/]+" },
    { key: "crypto", regex: "\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b" },
    { key: "crypto", regex: "\\b0x[a-fA-F0-9]{40}\\b" },
    { key: "id", regex: "\\b\\d{3}-\\d{3}-\\d{3}\\b" },
    { key: "creditcard", regex: "(?:\\d[ -]*?){13,16}" },
    { key: "creditcard", regex: "\\b(?:\\d[ -]*?){13,19}\\b" },
    {
        key: "date",
        // eslint-disable-next-line no-secrets/no-secrets
        regex: "\\b\\d{1,2}\\s+(january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{4}\\b",
    },
    { key: "date", regex: "\\b(0[1-9]|[12][0-9]|3[01])[- /.](0[1-9]|1[012])[- /.](19|20)\\d\\d\\b" },
    { key: "date", regex: "\\b\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\\b" },
    { key: "date", regex: "\\b(0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])[- /.](19|20)\\d\\d\\b" },
    {
        key: "date",
        // eslint-disable-next-line no-secrets/no-secrets
        regex: "\\b(january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{1,2},\\s+\\d{4}\\b",
    },
    { key: "date", regex: "\\b(19|20)\\d\\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])\\b" },
    { key: "date", regex: "\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b" },
    { key: "dl", regex: "\\b([A-Za-z]{1,2}\\s{0,1})?\\d{5,6}\\b" },
    { key: "domain", regex: "\\b((?!-)[A-Za-z0-9-]{1,63}(?<!-)\\.)+[A-Za-z]{2,6}\\b" },
    { key: "id", regex: "\\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-4[A-Fa-f0-9]{3}-[89ABab][A-Fa-f0-9]{3}-[A-Fa-f0-9]{12}\\b" },
    { key: "ip", regex: "\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b" },
    { key: "ip", regex: "\\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\\b" },
    { key: "token", regex: "\\beyJ[0-9a-zA-Z_\\-]*\\.[0-9a-zA-Z_\\-]*\\.[0-9a-zA-Z_\\-]*\\b" },
    { key: "mac_address", regex: "\\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\\b" },
    { key: "id", regex: "\\b\\d{9}\\b" },
    { key: "date", regex: "\\b(today|yesterday|tomorrow|last\\s+night|last\\s+week|next\\s+week)\\b" },
    // eslint-disable-next-line no-secrets/no-secrets
    { key: "date", regex: "\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\s\\d{1,2},\\s\\d{4}\\b" },
    { key: "phonenumber", regex: "\\+\\d+\\s\\(\\d{3}\\)\\s\\d{3}-\\d{4}" },
    { key: "routing", regex: "\\b\\d{9}\\b" },
    { key: "token", regex: "\\bxox[baprs]-[0-9a-zA-Z]{10,48}\\b" },
    { key: "ssn", regex: "\\b\\d{3}-\\d{2}-\\d{4}\\b" },
    { key: "time", regex: "\\b(1[012]|[1-9]):[0-5][0-9](\\s)?(am|pm)\\b" },
    { key: "time", regex: "\\b([01]?[0-9]|2[0-3]):[0-5][0-9]\\b" },
    { key: "time", regex: "\\b([01][0-9]|1[0-2]):[0-5][0-9]:[0-5][0-9](\\s)?(am|pm)\\b" },
    { key: "time", regex: "\\b([01]?[0-9]|1[0-2])\\s?(am|pm)\\b" },
    { key: "time", regex: "\\b([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\\b" },
    {
        key: "time",
        regex: "\\b\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.\\d{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])\\b",
    },
    { key: "uk_nin", regex: "\\b[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\\s?\\d{2}\\s?\\d{2}\\s?\\d{2}\\s?[A-D]\\b" },
    { key: "url", regex: "\\b((http|https):\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{2,256}\\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\\+.~#?&//=]*)" },
    { key: "ip", regex: "\\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\\b" },
    { key: "phonenumber", regex: "\\b\\(?[2-9][0-8][0-9]\\)?[-. ]?[2-9][0-9]{2}[-. ]?[0-9]{4}\\b" },
    { key: "id", regex: "\\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b" },
    { key: "us_social_security", regex: "\\b\\d{3}-\\d{2}-\\d{4}\\b" },
    {
        key: "isbn",
        regex: "\\b(?:ISBN(?:-13)?:? )?(?=[0-9]{13}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)97[89][- ]?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9]\\b",
    },
    { key: "zip_code", regex: "\\b[0-9]{5}(?:-[0-9]{4})?\\b" },
];

export type AnonymizeType =
    "apikey" | "awsid" | "awskey" | "bankcc" | "basic_auth" | "creditcard" | "crypto" | "date" | "domain" | "email" | "firstname" | "id" | "ip" | "isbn" | "lastname" | "mac_address" | "money" | "organization" | "passport" | "phonenumber" | "routing" | "ssn" | "time" | "token" | "uk_nin" | "url" | "us_social_security" | "zip_code";

export const regexesKeys: AnonymizeType[] = regexPatterns.map((pattern) => pattern.key) as AnonymizeType[];
