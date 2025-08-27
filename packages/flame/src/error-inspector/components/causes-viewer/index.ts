/* eslint-disable no-secrets/no-secrets */
import stackTraceViewer from "../stack-trace-viewer";
import { tooltip } from "../tooltip";
import svgToDataUrl from "../../util/svg-to-data-url";
// eslint-disable-next-line import/no-extraneous-dependencies
import plusIcon from "lucide-static/icons/plus.svg?raw";
// eslint-disable-next-line import/no-extraneous-dependencies
import minusIcon from "lucide-static/icons/minus.svg?raw";

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

            content.push(`<details aria-label="Cause ${index + 1}" class="relative rounded-[var(--flame-radius-lg)] mb-2 last:mb-0 group shadow-[var(--flame-elevation-2)] bg-[var(--flame-surface)]">
    <summary class="pl-5 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all inline-flex justify-between items-center gap-x-3 w-full font-semibold text-start py-4 px-5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-[var(--flame-text)]">
      ${cause.name}: ${cause.message}
      <span class="dui flame-expand-icon-closed size-4" style="-webkit-mask-image:url('${svgToDataUrl(plusIcon)}'); mask-image:url('${svgToDataUrl(plusIcon)}')"></span>
      <span class="dui flame-expand-icon-open size-4" style="-webkit-mask-image:url('${svgToDataUrl(minusIcon)}'); mask-image:url('${svgToDataUrl(minusIcon)}')"></span>
    </summary>
    <section class="w-full overflow-hidden transition-[height] duration-300 p-5 pt-0">
      ${stackTraceHtml}
    </section>
</details>`);
            scripts.push(stackTraceScript);
        } else if (typeof cause === "string") {
            content.push(`<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--flame-white-smoke)] text-[var(--flame-text)]">${cause}</div>`);
        } else {
            content.push(
                `<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--flame-white-smoke)] text-[var(--flame-text)]">${JSON.stringify(cause)}</div>`,
            );
        }
    }

    const tooltipHtml = tooltip({
        message: `The cause data property of an Error instance indicates the specific original cause of the error.<br><br>
            All causes in the error are order in the way they occurred.`,
    });

    return {
        html: `<section class="w-full">
    <div>
        <h3 class="text-xl font-bold inline-flex justify-center items-center text-[var(--flame-text)]">Error causes</h3>
        ${tooltipHtml}
    </div>
    <div class="mt-6">${content.join("\n")}</div>
</section>`,
        script: scripts.join("\n"),
    };
};

export default causes;
