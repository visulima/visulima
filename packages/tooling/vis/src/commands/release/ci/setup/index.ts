import type { CreateOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const ciSetupOptionDefinitions = {

} as const;

const ciSetup = defineCommand({
    commandPath: ["release", "ci"],
    description: "CI: print setup checklist for tokens (VIS_GH_TOKEN, NPM_TOKEN, OIDC) and workflow permissions",
    examples: [["vis release ci setup", "Walk through the recommended secrets + workflow setup"]],
    group: "Release",
    loader: () => import("./handler"),
    name: "setup",
    options: ciSetupOptionDefinitions,
});

export default ciSetup;

export type ReleaseCiSetupOptions = CreateOptions<Record<string, never>>;
