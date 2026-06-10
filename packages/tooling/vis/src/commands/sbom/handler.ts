import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { ensureDirSync } from "@visulima/fs";
import { dirname, resolve } from "@visulima/path";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { pail } from "../../io/logger";
import { buildCycloneDxBom, serializeBomToXml } from "../../sbom/cyclonedx";
import type { SbomOptions } from "./index";

type SbomFormat = "json" | "xml";

const SBOM_FORMATS: ReadonlyArray<SbomFormat> = ["json", "xml"];

const isSbomFormat = (value: string): value is SbomFormat => (SBOM_FORMATS as ReadonlyArray<string>).includes(value);

const execute = async ({ fs, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SbomOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run inside a monorepo.");
    }

    const { packageJsons, workspace } = discoverWorkspace(wsRoot, visConfig);
    const projectGraph = buildProjectGraph(wsRoot, workspace, packageJsons);

    const focusRaw = options.focus;
    const focus = focusRaw
        ? focusRaw
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
        : undefined;

    const format = (options.format ?? "json").toLowerCase();

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

    const output = options.output ?? (format === "xml" ? "sbom.cdx.xml" : "sbom.cdx.json");

    if (output === "-") {
        process.stdout.write(serialized);

        return;
    }

    const outPath = resolve(wsRoot, output);

    ensureDirSync(dirname(outPath));
    await fs.writeFile(outPath, serialized, "utf8");

    const componentCount = bom.components?.length ?? 0;
    const dependencyCount = bom.dependencies?.length ?? 0;

    pail.success(`SBOM written to ${outPath}`);
    pail.notice(`${componentCount} components, ${dependencyCount} dependency edges`);
};

export default execute as CommandExecute<Toolbox>;
