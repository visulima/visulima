// Compile-only fixture. Imports the published surface of @visulima/fs
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { collect, collectSync, EOL, ensureDir, ensureDirSync, findUp, findUpSync, glob, globSync, match } from "@visulima/fs";
import type { GlobOptions } from "@visulima/fs";

const eol: string = EOL;
declare const directory: string;

const collected: Promise<string[]> = collect(directory);
const collectedSync: string[] = collectSync(directory);

const ensured: Promise<void> = ensureDir(directory);
ensureDirSync(directory);

const foundAsync: Promise<string | undefined> = findUp("package.json");
const foundSync: string | undefined = findUpSync("package.json");

const globOptions: GlobOptions = { cwd: directory };
declare const globAsync: AsyncIterable<string>;
const globSyncResult: string[] = globSync("**/*.ts", globOptions);

const matched: boolean = match("foo/bar.ts", ["**/*.ts"]);

declare const globResult: ReturnType<typeof glob>;

export { collected, collectedSync, ensured, eol, foundAsync, foundSync, globAsync, globOptions, globResult, globSyncResult, matched };
