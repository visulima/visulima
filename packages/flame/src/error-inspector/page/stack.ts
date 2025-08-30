import { getErrorCauses, type VisulimaError } from "@visulima/error/error";

import type { SolutionError, SolutionFinder } from "../../types";
import type { ContentPage, TemplateOptions } from "../types";
import process from "../../util/process";
import runtimeName from "../../util/runtimes";
import causesViewer from "../components/causes-viewer";
import errorCard from "../components/error-card";
import rawStackTrace from "../components/raw-stack-trace";
import stackTraceViewer from "../components/stack-trace-viewer";

type ErrorType = Error | SolutionError | VisulimaError;

export const createStackPage = async (error: ErrorType, solutionFinders: SolutionFinder[], options: TemplateOptions = {}): Promise<ContentPage> => {
    const allCauses = getErrorCauses(error);

    if (allCauses.length === 0) {
        throw new Error("No errors found in the error stack");
    }

    const [mainCause, ...causes] = allCauses;

    const { html: errorCardHtml, scripts: errorCardScripts } = await errorCard({
        error: mainCause as Error,
        runtimeName,
        solutionFinders,
        version: process.version,
    });

    const { html: stackTraceHtml, script: stackTraceScript } = await stackTraceViewer(mainCause as Error, {
        openInEditorUrl: options.openInEditorUrl,
    });
    const { html: causesViewerHtml, script: causesViewerScript } = await causesViewer(causes, options);

    let html = `<div class="flex flex-col gap-6">`;
    html += errorCardHtml;
    html += stackTraceHtml;
    html += causesViewerHtml;
    html += rawStackTrace((mainCause as Error).stack);
    html += `</div>`;

    return {
        code: { html, script: [stackTraceScript, causesViewerScript, ...errorCardScripts].join("\n") },
        id: "stack",
        name: "Stack",
        defaultSelected: true,
    };
};
