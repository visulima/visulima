/**
 * Template executor router — dispatches to the correct executor
 * based on the resolved template type.
 */

import { executeBuiltin } from "./builtin";
import { executeGeneratorTemplate } from "./generator";
import { executeMonorepoTemplate } from "./monorepo";
import { executeRemoteGit, executeRemoteNpm } from "./remote";
import type { ExecutionContext, TemplateConfig } from "./types";

/**
 * Execute a template given its resolved configuration and runtime context.
 * @param config Resolved template info (type, source, extra args).
 * @param context Runtime context (cwd, PM, project name, target dir, config).
 * @returns Exit code — 0 on success, non-zero on failure.
 */
export const executeTemplate = async (config: TemplateConfig, context: ExecutionContext): Promise<number> => {
    switch (config.type) {
        case "builtin:app":
        case "builtin:library": {
            return executeBuiltin(config, context);
        }
        case "builtin:generator": {
            return executeGeneratorTemplate(context);
        }
        case "builtin:monorepo": {
            return executeMonorepoTemplate(context);
        }
        case "remote:git": {
            return executeRemoteGit(config, context);
        }
        case "remote:npm": {
            return executeRemoteNpm(config, context);
        }
        default: {
            throw new Error(`Unknown template type: ${config.type}`);
        }
    }
};

export type { ExecutionContext, TemplateConfig } from "./types";
