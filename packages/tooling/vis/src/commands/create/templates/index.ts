/**
 * Template executor router — dispatches to the correct executor
 * based on the resolved template type.
 */

import type { ExecutionContext, TemplateConfig } from "./types";
import { executeBuiltin } from "./builtin";
import { executeGeneratorTemplate } from "./generator";
import { executeMonorepoTemplate } from "./monorepo";
import { executeRemoteGit, executeRemoteNpm } from "./remote";

/**
 * Execute a template given its resolved configuration and runtime context.
 *
 * Returns the exit code (0 = success).
 */
export const executeTemplate = async (config: TemplateConfig, context: ExecutionContext): Promise<number> => {
    switch (config.type) {
        case "builtin:app":
        case "builtin:library": {
            return executeBuiltin(config, context);
        }
        case "builtin:monorepo": {
            return executeMonorepoTemplate(context);
        }
        case "builtin:generator": {
            return executeGeneratorTemplate(context);
        }
        case "remote:npm": {
            return executeRemoteNpm(config, context);
        }
        case "remote:git": {
            return executeRemoteGit(config, context);
        }
        default: {
            throw new Error(`Unknown template type: ${(config as TemplateConfig).type}`);
        }
    }
};

export type { ExecutionContext, TemplateConfig } from "./types";
