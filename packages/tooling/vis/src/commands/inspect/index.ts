import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

/**
 * `vis inspect &lt;pkg>` — dry-run every marshall against `&lt;pkg>[@&lt;spec>]`
 * without installing anything. Lets users pre-flight a dependency before
 * letting it touch the lockfile.
 */
const inspectOptionDefinitions = {
    json: {
        defaultValue: false,
        description: "Emit findings as a JSON document instead of the human-readable table.",
        type: Boolean,
    },
    only: {
        description:
                "Comma-separated subset of marshalls to run. Known: author, archivedRepo, downloads, expiredDomains, metadata, newBin, provenance, signatures. Signatures only runs when explicitly requested here.",
        type: String,
    },
    strict: {
        defaultValue: false,
        description: "Exit non-zero on any finding (warnings included). Default exits non-zero only on errors.",
        type: Boolean,
    },
} as const;

const inspect = defineCommand({
    argument: {
        description: "Package to inspect, optionally pinned: `<name>` or `<name>@<spec>`. `<spec>` may be a version, range, or dist-tag.",
        name: "package",
    },
    description: "Run all marshalls against a package without installing it",
    examples: [
        ["vis inspect express", "Run every marshall against express@latest"],
        ["vis inspect lodash@4.17.21", "Pin to an exact version"],
        ["vis inspect react@^18", "Resolve a semver range, then inspect the best match"],
        ["vis inspect express --json", "Emit findings as JSON for CI integration"],
        ["vis inspect express --strict", "Exit non-zero on any warning, not just errors"],
        ["vis inspect express --only author,downloads", "Run a subset of marshalls"],
        ["vis inspect express --only signatures", "Signatures are off by default; opt in with --only"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "inspect",
    options: inspectOptionDefinitions,
});

export default inspect;

export type InspectOptions = InferOptions<typeof inspectOptionDefinitions>;
