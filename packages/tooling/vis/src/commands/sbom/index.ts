import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

/**
 * `vis sbom` — CycloneDX 1.7 Software Bill of Materials generator.
 *
 * Mirrors `vis docker scaffold` in shape: accepts an optional `--focus`
 * list, walks the workspace graph, and writes the result to disk
 * (or stdout).
 */
const sbomOptionDefinitions = {
    focus: {
        description: "Project name(s) to focus on — comma-separated for multiple",
        type: String,
    },
    format: {
        defaultValue: "json",
        description: "Output format: json (default) or xml",
        type: String,
    },
    "include-dev": {
        defaultValue: false,
        description: "Include devDependencies (default: production only)",
        type: Boolean,
    },
    output: {
        description: "Output path (use '-' for stdout; default: sbom.cdx.json)",
        type: String,
    },
} as const;

const sbom = defineCommand({
    description: "Generate a CycloneDX 1.7 Software Bill of Materials for the workspace",
    examples: [
        ["vis sbom", "Write the full-workspace SBOM to sbom.cdx.json"],
        ["vis sbom --focus=my-app", "Scope the SBOM to my-app's transitive closure"],
        ["vis sbom --focus=my-app,other", "Focus multiple projects"],
        ["vis sbom --format=xml --output=sbom.cdx.xml", "Emit XML instead of JSON"],
        ["vis sbom --include-dev", "Include devDependencies (default: production only)"],
        ["vis sbom --output=-", "Write to stdout"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "sbom",
    options: sbomOptionDefinitions,
});

export default sbom;

export type SbomOptions = InferOptions<typeof sbomOptionDefinitions>;
