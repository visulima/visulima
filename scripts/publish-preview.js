// This tool is used by the pr ci to determine the packages that need to be published to the pkg-pr-new registry.

// @ts-check
import { execSync } from "node:child_process";
import { relative, join } from "node:path";
import { existsSync } from "node:fs";

if (!process.env.CHANGED_FILES) {
    throw new Error("CHANGED_FILES is missing");
}

const json = execSync(`pnpm -r list --only-projects --json`).toString("utf8");
/** @type {Array<{ path: string, private: boolean, peerDependencies?: Record<string, string> }>} */
const repoPackages = JSON.parse(json).filter(p => !p.private);

