import type { SolutionFinder } from "@visulima/error/solution";

import type { BaseCliOptions } from "../../../../shared/utils/cli-error-builder";
import { buildOutput } from "../../../../shared/utils/cli-error-builder";
import template from "./error-inspector";
import type { TemplateOptions as BaseTemplateOptions } from "./error-inspector/types";
import toJSON from "./to-json";

export type { OnoJson, OnoJsonError, OnoJsonFrame, ToJsonOptions } from "./to-json";

// eslint-disable-next-line @stylistic/no-extra-parens
const ensureError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

export type TemplateOptions = BaseTemplateOptions & { solutionFinders?: SolutionFinder[] };

export type CliOptions = BaseCliOptions;

/**
 * Render an error to a Shiki-highlighted HTML error page.
 * @param error the value thrown (any value is coerced to an `Error`).
 * @param options template options, including custom `solutionFinders`.
 */
export const renderHtml = async (error: unknown, options?: TemplateOptions): Promise<string> => {
    const errorInstance = ensureError(error);

    const { solutionFinders = [], ...templateOptions } = options ?? {};

    return template(errorInstance, solutionFinders, templateOptions);
};

/**
 * Render an error to ANSI terminal output.
 * @param error the value thrown (any value is coerced to an `Error`).
 * @param options CLI options forwarded to the shared ANSI builder.
 */
export const renderAnsi = async (error: unknown, options: CliOptions = {}): Promise<{ errorAnsi: string; solutionBox: undefined | string }> => {
    const errorInstance = ensureError(error);

    return buildOutput(errorInstance, options);
};

/**
 * Render an error to a structured, JSON-serializable payload (parsed frames, cause chain, runtime,
 * suggested solution). Useful for SPA/REST error responses (`Accept: application/json`).
 * @param error the value thrown (any value is coerced to an `Error`).
 * @param options optional custom `solutionFinders`.
 */
export const renderJson = toJSON;

/**
 * Convenience class wrapping the standalone {@link renderHtml}, {@link renderAnsi} and
 * {@link renderJson} renderers. The standalone functions are preferred for tree-shaking; the class
 * remains for backwards compatibility.
 */
export class Ono {
    /**
     * Render error to HTML.
     */
    // eslint-disable-next-line class-methods-use-this
    public async toHTML(error: unknown, options?: TemplateOptions): Promise<string> {
        return renderHtml(error, options);
    }

    /**
     * Render error to ANSI output.
     */
    // eslint-disable-next-line class-methods-use-this
    public async toANSI(error: unknown, options: CliOptions = {}): Promise<{ errorAnsi: string; solutionBox: undefined | string }> {
        return renderAnsi(error, options);
    }

    /**
     * Render error to a structured JSON payload.
     */
    // eslint-disable-next-line class-methods-use-this
    public async toJSON(error: unknown, options?: import("./to-json").ToJsonOptions): ReturnType<typeof toJSON> {
        return toJSON(error, options);
    }
}
