import { writeFileSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { ensureDirSync } from "@visulima/fs";
import { dirname, resolve } from "@visulima/path";

import { note, success } from "../output";
import { buildCycloneDxBom, serializeBomToXml } from "../sbom/cyclonedx";
import { buildProjectGraph, discoverWorkspace } from "../workspace";

type SbomFormat = "json" | "xml";

const SBOM_FORMATS: ReadonlyArray<SbomFormat> = ["json", "xml"];

const isSbomFormat = (value: string): value is SbomFormat => (SBOM_FORMATS as ReadonlyArray<string>).includes(value);

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
    execute: async ({ options, visConfig, workspaceRoot: wsRoot }) => {
        if (!wsRoot) {
            throw new Error("Could not determine workspace root. Run inside a monorepo.");
        }

        const { packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
        const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);

        const focusRaw = options.focus as string | undefined;
        const focus = focusRaw
            ? focusRaw
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean)
            : undefined;

        const format = ((options.format as string | undefined) ?? "json").toLowerCase();

        if (!isSbomFormat(format)) {
            throw new Error(`Unknown --format: "${format}". Expected one of: ${SBOM_FORMATS.join(", ")}.`);
        }

        const bom = buildCycloneDxBom({
            focus,
            includeDev: Boolean(options.includeDev),
            projectGraph,
            workspace,
            workspaceRoot: wsRoot,
        });

        const serialized = format === "xml" ? serializeBomToXml(bom) : `${JSON.stringify(bom, undefined, 2)}\n`;

        const output = (options.output as string | undefined) ?? (format === "xml" ? "sbom.cdx.xml" : "sbom.cdx.json");

        if (output === "-") {
            process.stdout.write(serialized);

            return;
        }

        const outPath = resolve(wsRoot, output);

        ensureDirSync(dirname(outPath));
        writeFileSync(outPath, serialized, "utf8");

        const componentCount = bom.components?.length ?? 0;
        const dependencyCount = bom.dependencies?.length ?? 0;

        success(`SBOM written to ${outPath}`);
        note(`${componentCount} components, ${dependencyCount} dependency edges`);
    },
    group: "Security & Health",
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
