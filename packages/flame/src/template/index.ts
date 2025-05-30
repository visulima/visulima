import type { VisulimaError } from "@visulima/error/error";
import { getErrorCauses } from "@visulima/error/error";

import type { Editor, SolutionError, SolutionFinder, Theme } from "../types";
import process from "../util/process";
import runtimeName from "../util/runtimes";
import errorCard from "./components/error-card";
import headerBar from "./components/header-bar";
import rawStackTrace from "./components/raw-stack-trace";
import stackTraceViewer from "./components/stack-trace-viewer";
import causesViewer from "./components/causes-viewer";
import inlineCss from "./index.css";
import layout from "./layout";

const template = async (
    error: Error | SolutionError | VisulimaError,
    solutionFinders: SolutionFinder[] = [],
    options: Partial<{ editor: Editor; openInBrowserUrl?: string; theme: Theme }> = {},
): Promise<string> => {
    const causes = getErrorCauses(error);
    const mainCause = causes.shift() as Error | SolutionError | VisulimaError;

    let html = "";

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;

    const { html: errorCardHtml, scripts: errorCardScripts } = await errorCard({
        error: mainCause,
        runtimeName,
        solutionFinders,
        version: process.version,
    });

    html += errorCardHtml;
    html += await stackTraceViewer(mainCause);

    const { html: causesViewerHtml, script: causesViewerScript } = await causesViewer(causes);

    html += causesViewerHtml;
    html += rawStackTrace(mainCause.stack);

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error: mainCause,
        scripts: [headerBarScript, ...errorCardScripts, causesViewerScript],
        title: "Error",
    });
};

export default template;
