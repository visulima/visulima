import type { VisulimaError } from "@visulima/error/error";

import type { SolutionError, SolutionFinder } from "../../types";
import type { TemplateOptions } from "../types";
import process from "../../util/process";
import runtimeName from "../../util/runtimes";
import causesViewer from "../components/causes-viewer";
import errorCard from "../components/error-card";
import rawStackTrace from "../components/raw-stack-trace";
import stackTraceViewer from "../components/stack-trace-viewer";

type ErrorType = Error | SolutionError | VisulimaError;

export default async function buildStackContent(
    error: ErrorType,
    causes: Error[],
    solutionFinders: SolutionFinder[],
    options: TemplateOptions = {},
): Promise<{ html: string; scripts: string[] }> {
    const { html: errorCardHtml, scripts: errorCardScripts } = await errorCard({
        error,
        runtimeName,
        solutionFinders,
        version: process.version,
    });

    const { html: stackTraceHtml, script: stackTraceScript } = await stackTraceViewer(error as Error, {
        openInEditorUrl: options.openInEditorUrl,
    });
    const { html: causesViewerHtml, script: causesViewerScript } = await causesViewer(causes, options);

    let html = `<div class="flex flex-col gap-6">`;
    html += errorCardHtml;
    html += stackTraceHtml;
    html += causesViewerHtml;
    html += rawStackTrace((error as Error).stack);
    html += `</div>`;

    const scripts = [stackTraceScript, causesViewerScript, ...errorCardScripts];

    return { html, scripts };
}
