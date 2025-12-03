import type { SolutionFinder } from "@visulima/error/solution";

import type { BaseCliOptions } from "../../../../shared/utils/cli-error-builder";
import { buildOutput } from "../../../../shared/utils/cli-error-builder";
import template from "./error-inspector";
import type { TemplateOptions as BaseTemplateOptions } from "./error-inspector/types";

// eslint-disable-next-line @stylistic/no-extra-parens
const ensureError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

export type TemplateOptions = BaseTemplateOptions & { solutionFinders?: SolutionFinder[] };

export type CliOptions = BaseCliOptions;

export class Ono {
    /**
     * Render error to HTML.
     */
    // eslint-disable-next-line class-methods-use-this
    public async toHTML(error: unknown, options?: TemplateOptions): Promise<string> {
        const errorInstance = ensureError(error);

        const { solutionFinders = [], ...templateOptions } = options ?? {};

        return await template(errorInstance, solutionFinders, templateOptions);
    }

    /**
     * Render error to ANSI output.
     */
    // eslint-disable-next-line class-methods-use-this
    public async toANSI(error: unknown, options: CliOptions = {}): Promise<{ errorAnsi: string; solutionBox: undefined | string }> {
        const errorInstance = ensureError(error);

        return buildOutput(errorInstance, options);
    }
}
