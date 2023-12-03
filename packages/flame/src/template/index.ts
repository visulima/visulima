import { VisulimaError } from "@visulima/error/error";

import process from "../util/process";
import runtimeName from "../util/runtimes";
import errorCard from "./components/error-card";
import rawStackTrace from "./components/raw-stack-trace";
import inlineCss from "./index.css";
import prelineJs from "inline:../../node_modules/preline/dist/preline.js";
import clipboardJs from "inline:../../node_modules/clipboard/dist/clipboard.min.js";
import layout from "./layout";
import stackTraceViewer from "./components/stack-trace-viewer";
import headerBar from "./components/header-bar";
import type { Editor, Hint, Theme } from "../types";

type HintError = Error & { hint: string | string[] | Hint | undefined };

const getHint = (error: HintError): Hint | undefined => {
    if (typeof error.hint === "undefined") {
        return undefined;
    }

    if (typeof error.hint === "string") {
        return { body: error.hint };
    }

    if (typeof error.hint === "object") {
        return error.hint as Hint;
    }

    if (Array.isArray(error.hint)) {
        return { body: (error.hint as string[]).join("\n") };
    }

    return undefined;
};

const index = async (error: Error | VisulimaError, options: Partial<{ editor: Editor; theme: Theme }> = {}): Promise<string> => {
    const { message, name, stack } = error;

    let html = "";
    let script = "";

    script += clipboardJs;
    script += prelineJs;

    const { html: headerBarHtml, script: headerBarScript } = headerBar(options);

    html += headerBarHtml;
    script += headerBarScript;

    html += errorCard({
        hint: getHint(error as HintError),
        message,
        runtimeName,
        title: name,
        version: process.version,
    });
    html += await stackTraceViewer(error);
    html += rawStackTrace(stack);

    return layout({
        title: "Error",
        description: "Error",
        css: inlineCss.trim(),
        script: script.trim(),
        content: html.trim(),
        error,
    });
};

export default index;
