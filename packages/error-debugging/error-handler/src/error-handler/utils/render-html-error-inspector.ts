import { codeFrame } from "@visulima/error/code-frame";
import { getErrorCauses } from "@visulima/error/error";
import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { errorHintFinder, ruleBasedFinder } from "@visulima/error/solution";
import type { Trace } from "@visulima/error/stacktrace";
import { parseStacktrace } from "@visulima/error/stacktrace";

import findLanguageBasedOnExtension from "../../../../../../shared/utils/find-language-based-on-extension";
import getFileSource from "../../../../../../shared/utils/get-file-source";

/**
 * Options that influence how the development HTML error inspector is rendered.
 */
type HtmlErrorInspectorOptions = {
    /**
     * Permit the underlying code-frame reader to fetch `http(s):`/`data:`
     * stack-frame URLs over the network. Off by default to avoid an SSRF
     * surface; only enable when frame URLs are known to be trusted.
     * @default false
     */
    allowRemoteSources?: boolean;

    /**
     * Number of source lines rendered above the offending line in the code frame.
     * @default 4
     */
    linesAbove?: number;

    /**
     * Number of source lines rendered below the offending line in the code frame.
     * @default 4
     */
    linesBelow?: number;

    /**
     * Extra solution finders to run before the built-in rule-based and
     * error-hint finders. The first finder (sorted by descending priority)
     * that returns a hint wins. Matches the CLI handler's behaviour.
     */
    solutionFinders?: SolutionFinder[];
};

const LEADING_HEADING_MARKUP = /^\s*#+\s*/;

/**
 * Escape the five HTML-significant characters so error messages, stack traces
 * and source snippets cannot break out of the page or inject markup.
 * @param value The raw string to escape.
 * @returns The HTML-safe string.
 */
const escapeHtml = (value: string): string =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");

const sanitizeTitle = (title: string): string => title.replace(LEADING_HEADING_MARKUP, "").trim();

/**
 * Runs the configured solution finders against the error and returns the first
 * matching hint, mirroring the CLI handler's resolution order (caller-supplied
 * finders first, then the built-in rule-based and error-hint finders).
 * @param error The error being rendered.
 * @param solutionFinders Caller-supplied finders, run before the built-ins.
 * @param firstTrace The first stack frame that resolved to a file.
 * @param snippet The source of {@link firstTrace}, when readable.
 * @returns The first matching solution, or `undefined`.
 */
const runSolutionFinders = async (
    error: Error,
    solutionFinders: SolutionFinder[],
    firstTrace: Pick<Trace, "file" | "line">,
    snippet: string,
): Promise<Solution | undefined> => {
    const candidates = [...solutionFinders, ruleBasedFinder, errorHintFinder].toSorted((a, b) => a.priority - b.priority);

    for (const handler of candidates) {
        if (typeof handler.handle !== "function") {
            continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const hint = await handler.handle(error, {
            file: firstTrace.file ?? "",
            language: findLanguageBasedOnExtension(firstTrace.file ?? ""),
            line: firstTrace.line ?? 0,
            snippet,
        });

        if (hint) {
            return hint;
        }
    }

    return undefined;
};

const formatFrameLocation = (trace: Trace): string => {
    if (!trace.file) {
        return escapeHtml(trace.raw);
    }

    let location = escapeHtml(trace.file);

    if (trace.line !== undefined) {
        location += `:${String(trace.line)}`;

        if (trace.column !== undefined) {
            location += `:${String(trace.column)}`;
        }
    }

    return location;
};

const renderStackList = (traces: Trace[]): string => {
    if (traces.length === 0) {
        return "";
    }

    const items = traces
        .map((trace) => {
            const method = escapeHtml(trace.methodName ?? "<anonymous>");
            const location = formatFrameLocation(trace);

            return String.raw`<li class="vis-frame"><span class="vis-frame-method">${method}</span><span class="vis-frame-loc">${location}</span></li>`;
        })
        .join("");

    return String.raw`<ol class="vis-frames">${items}</ol>`;
};

const renderSolution = (solution: Solution | undefined): string => {
    if (!solution) {
        return "";
    }

    const header = escapeHtml(sanitizeTitle(solution.header ?? "A possible solution to this error"));
    const body = escapeHtml(solution.body);

    return String.raw`
                <section class="vis-card vis-solution">
                    <h2 class="vis-card-title">💡 ${header}</h2>
                    <pre class="vis-solution-body">${body}</pre>
                </section>`;
};

/**
 * Builds the inner HTML for the development error inspector: error name +
 * message, a syntax-free code frame for the offending source line, the parsed
 * stack trace (one entry per cause), and a possible-solution hint.
 *
 * All dynamic content is HTML-escaped. This is intended for development output
 * only — callers must keep it off the production path so stack/source are not
 * leaked.
 * @param error The error to render.
 * @param options Inspector rendering options.
 * @returns The escaped inner HTML for the inspector.
 */
const renderHtmlErrorInspector = async (error: Error, options: HtmlErrorInspectorOptions = {}): Promise<string> => {
    const { allowRemoteSources = false, linesAbove = 4, linesBelow = 4, solutionFinders = [] } = options;

    const causes = getErrorCauses(error);
    const primary = causes[0] ?? error;

    const traces = parseStacktrace(primary);
    const firstTrace: Trace = traces.find((trace) => Boolean(trace.file)) ?? traces[0] ?? { raw: "" };

    let codeFrameHtml = "";
    let snippet = "";

    if (firstTrace.file && firstTrace.line !== undefined) {
        const source = await getFileSource(firstTrace.file, { allowRemote: allowRemoteSources });

        if (source) {
            snippet = source;

            const frame = codeFrame(source, { start: { column: firstTrace.column, line: firstTrace.line } }, { linesAbove, linesBelow });

            codeFrameHtml = String.raw`
                <section class="vis-card">
                    <h2 class="vis-card-title">${escapeHtml(`${firstTrace.file}:${String(firstTrace.line)}`)}</h2>
                    <pre class="vis-codeframe"><code>${escapeHtml(frame)}</code></pre>
                </section>`;
        }
    }

    const solution = await runSolutionFinders(error, solutionFinders, firstTrace, snippet);

    const errorName = escapeHtml(error.name || "Error");
    const errorMessage = escapeHtml(error.message || "");

    const stackHtml
        = traces.length > 0
            ? String.raw`
                <section class="vis-card">
                    <h2 class="vis-card-title">Stack trace</h2>
                    ${renderStackList(traces)}
                </section>`
            : "";

    return String.raw`
            <div class="vis-inspector max-w-6xl mx-auto px-6 mt-8">
                <section class="vis-card vis-headline">
                    <span class="vis-error-name">${errorName}</span>
                    <p class="vis-error-message">${errorMessage}</p>
                </section>${codeFrameHtml}${renderSolution(solution)}${stackHtml}
            </div>`;
};

export type { HtmlErrorInspectorOptions };
export default renderHtmlErrorInspector;
