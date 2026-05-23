// Compile-only fixture. Imports the published surface of @visulima/error-handler
// so a broken dist/*.d.ts will fail `tsc --noEmit`.
import * as pkg from "@visulima/error-handler";

const exportCount: number = Object.keys(pkg).length;
const hasExports: boolean = exportCount > 0;

export { exportCount, hasExports };
