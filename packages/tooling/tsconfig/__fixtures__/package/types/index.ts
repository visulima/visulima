// Compile-only fixture. Imports the published surface of @visulima/tsconfig
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { findTsConfig, findTsConfigSync, readTsConfig } from "@visulima/tsconfig";
import type { TsConfigJsonResolved, TsConfigResult } from "@visulima/tsconfig";

declare const cwd: string;
const found: Promise<TsConfigResult> = findTsConfig(cwd);
const foundSync: TsConfigResult = findTsConfigSync(cwd);

declare const tsconfigPath: string;
const config: TsConfigJsonResolved = readTsConfig(tsconfigPath);

export { config, found, foundSync };
