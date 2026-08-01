import * as pkg from "@visulima/disposable-email-domains";
// Imported without an import attribute on purpose. The `./domains` subpath used
// to resolve straight to `domains.json`, so this line threw
// ERR_IMPORT_ATTRIBUTE_MISSING at runtime while still type-checking. The types
// fixture is compile-only and could not catch that.
import domains from "@visulima/disposable-email-domains/domains";

if (typeof pkg !== "object" || pkg === null) {
    throw new Error("expected exports to be an object");
}

if (Object.keys(pkg).length === 0) {
    throw new Error("expected non-empty exports");
}

if (!Array.isArray(domains)) {
    throw new TypeError("expected the ./domains subpath to default-export an array");
}

if (domains.length === 0) {
    throw new Error("expected a non-empty domains list");
}

console.log("ok");
