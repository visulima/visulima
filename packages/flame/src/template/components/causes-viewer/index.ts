/* eslint-disable no-secrets/no-secrets */
import stackTraceViewer from "../stack-trace-viewer";
import { tooltip } from "../tooltip";

const causes = async (causeList: unknown[]): Promise<{ html: string; script: string }> => {
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
            const { html: stackTraceHtml, script: stackTraceScript } = await stackTraceViewer(cause);

            content.push(`<details aria-label="Cause ${index + 1}" class="rounded-xl mb-2 last:mb-0 group shadow-xl bg-[var(--flame-white-smoke)]">
    <summary class="focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all inline-flex justify-between items-center gap-x-3 w-full font-semibold text-start py-4 px-5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-[var(--flame-charcoal-black)]">
      ${cause.name}: ${cause.message}
      <svg class="block group-open:hidden w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
      <svg class="hidden group-open:block! w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>
    </summary>
    <section class="w-full overflow-hidden transition-[height] duration-300 p-5">
      ${stackTraceHtml}
    </section>
</details>`);
            scripts.push(stackTraceScript);
        } else if (typeof cause === "string") {
            content.push(
                `<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--flame-white-smoke)] text-[var(--flame-charcoal-black)]">${cause}</div>`,
            );
        } else {
            content.push(
                `<div class="container rounded-lg mt-2 py-4 px-5 shadow-xl bg-[var(--flame-white-smoke)] text-[var(--flame-charcoal-black)]">${JSON.stringify(cause)}</div>`,
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
        <h3 class="text-xl font-bold inline-flex justify-center items-center text-[var(--flame-charcoal-black)]">Error causes</h3>
        ${tooltipHtml}
    </div>
    <div class="mt-6">${content.join("\n")}</div>
</section>`,
        script: scripts.join("\n"),
    };
};

export default causes;
