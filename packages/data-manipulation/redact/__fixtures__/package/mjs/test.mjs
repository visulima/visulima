import { redact, stringAnonymize, standardRules } from "@visulima/redact";

const input = "John Doe will be 30 on 2024-06-10.";

console.log(redact(input, standardRules));
console.log(stringAnonymize(input, standardRules));
