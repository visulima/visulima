// Compile-only fixture. Imports the published surface of @visulima/ono
// so a broken dist/*.d.ts will fail `tsc --noEmit`.
import * as pkg from "@visulima/ono";

const exportCount: number = Object.keys(pkg).length;
const hasExports: boolean = exportCount > 0;

export { exportCount, hasExports };
