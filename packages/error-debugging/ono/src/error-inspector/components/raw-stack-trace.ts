import { sanitizeHtml } from "../utils/sanitize";
import tooltip from "./tooltip";

const rawStackTrace = (stack?: string): string => {
    const tooltipHtml = tooltip({ message: `The orginal stack trace from the main error.` });

    const safeStack = sanitizeHtml(stack);

    return `<section>
    <h3 class="text-xl font-bold inline-flex justify-center items-center text-[var(--ono-text)]">Stack Trace</h3>
    ${tooltipHtml}
    <div class="container rounded-[var(--ono-radius-lg)] shadow-[var(--ono-elevation-1)] my-6 bg-[var(--ono-surface)]">
        <main id="raw-stack-trace" class="p-6 prose prose-sm max-w-full text-[var(--ono-text)]">${safeStack}</main>
    </div>
</section>`;
};

export default rawStackTrace;
