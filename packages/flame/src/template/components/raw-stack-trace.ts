import { tooltip } from "./tooltip";

const rawStackTrace = (stack?: string): string => {
    const tooltipHtml = tooltip({ message: `The orginal stack trace from the main error.` });

    return `<section>
    <h3 class="text-xl font-bold inline-flex justify-center items-center text-[var(--flame-charcoal-black)]">Stack Trace</h3>
    ${tooltipHtml}
    <div class="container rounded-lg shadow-xl my-6 bg-[var(--flame-white-smoke)]">
        <main id="raw-stack-trace" class="p-6 prose prose-sm max-w-full text-[var(--flame-charcoal-black)]">${stack}</main>
    </div>
</section>`;
};

export default rawStackTrace;
