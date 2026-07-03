// Compile-only fixture. Imports the published surface of @visulima/path
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import { basename, delimiter, dirname, isAbsolute, join, normalize, parse, resolve, sep } from "@visulima/path";
import type { Path } from "@visulima/path";

const joined: string = join("a", "b", "c");
const resolved: string = resolve("foo");
const normalized: string = normalize("a/./b/../c");
const dir: string = dirname("a/b/c.txt");
const base: string = basename("a/b/c.txt");
const parsed = parse("a/b/c.txt");
const absolute: boolean = isAbsolute("/x");
const separator: string = sep;
const delim: string = delimiter;

declare const platform: Path;
const platformJoin: string = platform.join("a", "b");

export { absolute, base, delim, dir, joined, normalized, parsed, platformJoin, resolved, separator };
