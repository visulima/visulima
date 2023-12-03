import type { Hint } from "../../../types";

const codeBlock = (hint?: Hint | undefined): string => {
    if (!hint) {
        return "";
    }

    return `
    <div class="px-6 pb-6">
        <div class="bg-green-300 dark:bg-gray-700/50 dark:bg-gradient-to-bl from-gray-700/50 via-transparent dark:ring-1 dark:ring-inset dark:ring-white/5 rounded-lg shadow-2xl shadow-gray-500/20">
            <div class="px-4 py-5 sm:p-6">
                <span class="inline-flex items-center pb-2 text-sm">
                    A possible solution to this error:
                </span>
                ${
                    hint?.header
                        ? `<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    ${hint.header}
                </h3>`
                        : ""
                }
                <div class="mt-2 max-w-xl text-sm font-medium">
                    ${hint.body}
                </div>
            </div>
        </div>
    </div>`;
};

export default codeBlock;
