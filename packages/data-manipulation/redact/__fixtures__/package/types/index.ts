// Compile-only fixture. Imports the published surface of @visulima/redact
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { redact, standardRules, stringAnonymize } from "@visulima/redact";
import type { RedactOptions, Rules } from "@visulima/redact";

const rules: Rules = standardRules;
const options: RedactOptions = {};

const string_: string = redact("Hello world", rules, options);
const obj: { secret: string } = redact({ secret: "abc" }, rules);
const anonymized: string = stringAnonymize("abc", rules);

export { anonymized, obj, options, rules, string_ };
