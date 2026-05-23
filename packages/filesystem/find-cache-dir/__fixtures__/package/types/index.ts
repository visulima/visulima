// Compile-only fixture. Imports the published surface of @visulima/find-cache-dir
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { findCacheDir, findCacheDirSync } from "@visulima/find-cache-dir";

const asyncResult: Promise<string | undefined> = findCacheDir("my-pkg");
const syncResult: string | undefined = findCacheDirSync("my-pkg");

export { asyncResult, syncResult };
