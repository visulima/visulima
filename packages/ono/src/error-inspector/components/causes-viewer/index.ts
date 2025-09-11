// eslint-disable-next-line import/no-extraneous-dependencies
import minusIcon from "lucide-static/icons/minus.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import plusIcon from "lucide-static/icons/plus.svg?data-uri&encoding=css";

import { sanitizeHtml } from "../../utils/sanitize";
import stackTraceViewer from "../stack-trace-viewer";
import tooltip from "../tooltip";

const causes = async (causeList: unknown[], options: { openInEditorUrl?: string } = {}): Promise<{ html: string; script: string }> => {
    if (causeList.length === 0) {
        return {
            html: "",
            script: "",
        };
    }

    const content: string[] = [];
    const scripts: string[] = [];

    for await (const [index, cause] of causeList.entries()) {
        if (cause instanceof Error) {
            const { html: stackTraceHtml, script: stackTraceScript } = await stackTraceViewer(cause, {
                openInEditorUrl: options.openInEditorUrl,
            });

            content.push(`<details aria-label="Cause ${index + 1}" class="relative rounded-[var(--ono-radius-lg)] mb-2 last:mb-0 group shadow-[var(--ono-elevation-1)] bg-[var(--ono-surface)]">
    <summary class="pl-5 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all inline-flex justify-between items-center gap-x-3 w-full font-semibold text-start py-4 px-5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-[var(--ono-text)]">
      ${sanitizeHtml(cause.name)}: ${sanitizeHtml(cause.message)}
      <span class="dui ono-expand-icon-closed size-4" style="-webkit-mask-image:url('${plusIcon}'); mask-image:url('${plusIcon}')"></span>
      <span class="dui ono-expand-icon-open size-4" style="-webkit-mask-image:url('${minusIcon}'); mask-image:url('${minusIcon}')"></span>
    </summary>
    <section class="w-full overflow-hidden transition-[height] duration-300 p-5 pt-0">
      ${stackTraceHtml}
    </section>
</details>`);
            scripts.push(stackTraceScript);
        } else if (typeof cause === "string") {
            content.push(
                `<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--ono-white-smoke)] text-[var(--ono-text)]">${sanitizeHtml(cause)}</div>`,
            );
        } else {
            content.push(
                `<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--ono-white-smoke)] text-[var(--ono-text)]">${sanitizeHtml(JSON.stringify(cause))}</div>`,
            );
        }
    }

    const tooltipHtml = tooltip({
        message: `The cause data property of an Error instance indicates the specific original cause of the error.
            All causes in the error are order in the way they occurred.`,
    });

    return {
        html: `<style>
  /* Toggle plus/minus icons inside <details> */
  details summary .ono-expand-icon-open { display: none !important; }
  details[open] summary .ono-expand-icon-open { display: inline-block !important; }
  details[open] summary .ono-expand-icon-closed { display: none !important; }
</style>
<section class="w-full">
    <div>
        <h3 class="text-xl font-bold inline-flex justify-center items-center text-[var(--ono-text)]">Error causes</h3>
        ${tooltipHtml}
    </div>
    <div class="mt-6">${content.join("\n")}</div>
</section>`,
        script: scripts.join("\n"),
    };
};

export default causes;
