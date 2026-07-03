// Compile-only fixture. Imports the published surface of @visulima/redact
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { createRedactor, credentialRules, dateTimeRules, piiRules, redact, standardRules, stringAnonymize } from "@visulima/redact";
import type { Anonymize, Censor, RedactOptions, Rules, StringAnonymize } from "@visulima/redact";

const rules: Rules = [...credentialRules, ...piiRules, ...dateTimeRules, ...standardRules];
const options: RedactOptions = {};

const string_: string = redact("Hello world", rules, options);
const obj: { secret: string } = redact({ secret: "abc" }, rules);
const anonymized: string = stringAnonymize("abc", rules);

const censor: Censor = (value) => String(value).slice(-4);
const anonymizeRule: Anonymize = { key: "card", remove: false, replacement: censor };
const patternRule: StringAnonymize = { key: "x", pattern: /x/, replacement: "<X>" };

const scrub = createRedactor([anonymizeRule, patternRule]);
const scrubbed: { card: string } = scrub({ card: "4111111111111111" });

export { anonymized, anonymizeRule, censor, obj, options, patternRule, rules, scrubbed, string_ };
