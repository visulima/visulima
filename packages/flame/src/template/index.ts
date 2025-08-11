import type { VisulimaError } from "@visulima/error/error";
import { getErrorCauses } from "@visulima/error/error";

import type { Editor, SolutionError, SolutionFinder, Theme } from "../types";
import process from "../util/process";
import runtimeName from "../util/runtimes";
import causesViewer from "./components/causes-viewer";
import errorCard from "./components/error-card";
import headerBar from "./components/header-bar";
import rawStackTrace from "./components/raw-stack-trace";
import stackTraceViewer from "./components/stack-trace-viewer";
import inlineCss from "./index.css";
import layout from "./layout";

type ErrorType = Error | SolutionError | VisulimaError;

const template = async (
    error: ErrorType,
    solutionFinders: SolutionFinder[] = [],
    options: Partial<{ editor: Editor; openInEditorUrl?: string; theme: Theme }> = {},
): Promise<string> => {
    const allCauses = getErrorCauses(error);

    if (allCauses.length === 0) {
        throw new Error("No error causes found");
    }

    const [mainCause, ...causes] = allCauses;

    let html = "";

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;

    const { html: errorCardHtml, scripts: errorCardScripts } = await errorCard({
        error: mainCause as ErrorType,
        runtimeName,
        solutionFinders,
        version: process.version,
    });

    html += errorCardHtml;

    const { html: stackTraceHtml, script: stackTraceScript } = await stackTraceViewer(mainCause as ErrorType);

    html += stackTraceHtml;

    const { html: causesViewerHtml, script: causesViewerScript } = await causesViewer(causes);

    html += causesViewerHtml;
    html += rawStackTrace((mainCause as ErrorType).stack);

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error: mainCause as ErrorType,
        scripts: [headerBarScript, ...errorCardScripts, stackTraceScript, causesViewerScript],
        title: "Error",
    });
};

export default template;
