// Compile-only fixture. Imports the published surface of @visulima/disposable-email-domains
// so a broken dist/*.d.ts will fail `tsc --noEmit`.
import * as pkg from "@visulima/disposable-email-domains";
// The `./domains` subpath ships its own declaration; importing it here fails the
// type check if dist/domains.d.ts is an invalid ESM declaration (e.g. `export =`).
import domains from "@visulima/disposable-email-domains/domains";

const exportCount: number = Object.keys(pkg).length;
const hasExports: boolean = exportCount > 0;
const domainCount: number = domains.length;

export { domainCount, exportCount, hasExports };
