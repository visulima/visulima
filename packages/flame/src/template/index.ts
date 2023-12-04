import type { VisulimaError } from "@visulima/error/error";
// eslint-disable-next-line import/extensions
import clipboardJs from "inline:../../node_modules/clipboard/dist/clipboard.min.js";
// eslint-disable-next-line import/extensions
import prelineJs from "inline:../../node_modules/preline/dist/preline.js";

import type { Editor, SolutionError, SolutionFinder, Theme } from "../types";
import process from "../util/process";
import runtimeName from "../util/runtimes";
import errorCard from "./components/error-card";
import headerBar from "./components/header-bar";
import rawStackTrace from "./components/raw-stack-trace";
import stackTraceViewer from "./components/stack-trace-viewer";
import inlineCss from "./index.css";
import layout from "./layout";

const template = async (
    error: Error | SolutionError | VisulimaError,
    solutionFinders: SolutionFinder[] = [],
    options: Partial<{ editor: Editor; openInBrowserUrl?: string; theme: Theme }> = {},
): Promise<string> => {
    let html = "";
    let script = "";

    script += clipboardJs;
    script += prelineJs;

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;
    script += headerBarScript;

    html += await errorCard({
        error,
        runtimeName,
        solutionFinders,
        version: process.version,
    });
    html += await stackTraceViewer(error);
    html += rawStackTrace(error.stack);

    return layout({
        content: html.trim(),
        css: inlineCss.trim(),
        description: "Error",
        error,
        script: script.trim(),
        title: "Error",
    });
};

export default template;
