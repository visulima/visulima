import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis sbom` — CycloneDX 1.6 Software Bill of Materials generator.
 *
 * Mirrors `vis docker scaffold` in shape: accepts an optional `--focus`
 * list, walks the workspace graph, and writes the result to disk
 * (or stdout).
 */
const sbom: Command = {
    description: "Generate a CycloneDX 1.6 Software Bill of Materials for the workspace",
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
    options: [
        {
            description: "Project name(s) to focus on — comma-separated for multiple",
            name: "focus",
            type: String,
        },
        {
            defaultValue: "json",
            description: "Output format: json (default) or xml",
            name: "format",
            type: String,
        },
        {
            description: "Output path (use '-' for stdout; default: sbom.cdx.json)",
            name: "output",
            type: String,
        },
        {
            defaultValue: false,
            description: "Include devDependencies (default: production only)",
            name: "include-dev",
            type: Boolean,
        },
    ],
};

export default sbom;

export type SbomOptions = CreateOptions<{
    "focus": string | undefined;
    "format": string | undefined;
    "output": string | undefined;
    "include-dev": boolean | undefined;
}>;
