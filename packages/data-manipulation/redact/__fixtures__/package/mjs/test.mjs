import { redact, stringAnonymize, standardRules } from "@visulima/redact";
import { compromiseScanner } from "@visulima/redact/nlp";

const input = "John Doe will be 30 on 2024-06-10.";
const options = { nlp: compromiseScanner };

console.log(redact(input, standardRules, options));
console.log(stringAnonymize(input, standardRules, options));
