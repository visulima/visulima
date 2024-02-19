import colorize, { bgGrey, bgWhite, bold, grey, underline } from "@visulima/colorize/browser";
import { format } from "@visulima/fmt";

import type { ReadonlyMeta } from "../../types";
import { getLongestLabel } from "../../util/get-longest-label";
import { writeConsoleLogBasedOnLevel } from "../../util/write-console-log";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

export class PrettyReporter<T extends string = never, L extends string = never> extends AbstractPrettyReporter<T, L> {
    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super({
            dateFormatter: (date: Date) => [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":"),
            uppercase: {
                label: true,
                ...options.uppercase,
            },
            ...options,
        });
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async log(meta: ReadonlyMeta<L>): Promise<void> {
        const isNotBrowser = typeof window === "undefined";
        const consoleLogFunction = writeConsoleLogBasedOnLevel(meta.type.level);

        const { badge, context, date, error, groups, label, message, prefix, repeated, scope, suffix, type } = meta;

        const { color } = this._loggerTypes[type.name as keyof typeof this._loggerTypes];
        // eslint-disable-next-line security/detect-object-injection
        const colorized = color ? colorize[color] : bgWhite;
        const items = [];

        if (date) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const cDate = grey(this._styles.dateFormatter(new Date(date)));

            if (isNotBrowser && Array.isArray(cDate)) {
                items.push(format(cDate[0] as string, cDate.slice(1) as unknown as string[]));
            } else {
                items.push(Array.isArray(cDate) ? [(cDate[0] as string) + " ", ...cDate.slice(1)] : cDate + " ");
            }
        }

        if (badge) {
            const cBadge = colorized(badge);

            if (isNotBrowser && Array.isArray(cBadge)) {
                items.push(format(cBadge[0] as string, cBadge.slice(1) as unknown as string[]));
            } else {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                items.push(Array.isArray(cBadge) ? [cBadge[0] + " ", ...cBadge.slice(1)] : cBadge + " ");
            }
        }

        if (label) {
            const cLabel = colorized(this._formatLabel(label as string));

            if (isNotBrowser && Array.isArray(cLabel)) {
                items.push(format(cLabel[0] as string, cLabel.slice(1) as unknown as string[]));
            } else {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                items.push(Array.isArray(cLabel) ? [cLabel[0] + " ", ...cLabel.slice(1)] : cLabel + " ");
            }

            if (repeated) {
                const cRepeated = bgGrey.white("[" + repeated + "x]");

                if (isNotBrowser && Array.isArray(cRepeated)) {
                    items.push(format(cRepeated[0] as string, cRepeated.slice(1) as unknown as string[]));
                } else {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    items.push(Array.isArray(cRepeated) ? [cRepeated[0] + " ", ...cRepeated.slice(1)] : cRepeated + " ");
                }
            }
        } else {
            const longestLabel = getLongestLabel<L, T>(this._loggerTypes);
            // plus 2 for the space and the dot
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const cPlaceholder = grey(" ".repeat(longestLabel.length + 2));

            if (isNotBrowser && Array.isArray(cPlaceholder)) {
                items.push(format(cPlaceholder[0] as string, cPlaceholder.slice(1) as unknown as string[]));
            } else {
                items.push(cPlaceholder);
            }
        }

        if (Array.isArray(scope) && scope.length > 0) {
            const cScope = grey("[" + scope.join(" | ") + "]");

            if (isNotBrowser && Array.isArray(cScope)) {
                items.push(format(cScope[0] as string, cScope.slice(1) as unknown as string[]));
            } else {
                items.push(cScope);
            }
        }

        if (prefix) {
            const cPrefix = grey(
                (Array.isArray(scope) && scope.length > 0 ? ". " : " ") + "[" + (this._styles.underline.prefix ? underline(prefix as string) : prefix) + "] ",
            );

            if (isNotBrowser && Array.isArray(cPrefix)) {
                items.push(format(cPrefix[0] as string, cPrefix.slice(1) as unknown as string[]));
            } else {
                items.push(Array.isArray(cPrefix) ? [cPrefix[0] as string, ...cPrefix.slice(1)] : cPrefix);
            }
        }

        if (message) {
            items.push(message);

            if (context) {
                items.push(context);
            }
        }

        if (error) {
            items.push(error);
        }

        if (suffix) {
            const cSuffix = grey(this._styles.underline.suffix ? underline(suffix as string) : suffix);

            if (isNotBrowser && Array.isArray(cSuffix)) {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                items.push(format(("\n" + cSuffix[0]) as string, cSuffix.slice(1) as unknown as string[]));
            } else {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                items.push(Array.isArray(cSuffix) ? [("\n" + cSuffix[0]) as string, ...cSuffix.slice(1)] : "\n" + cSuffix);
            }
        }

        if (isNotBrowser) {
            consoleLogFunction(...items);
        } else {
            let logMessage = "";
            const css = [];
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const arguments_ = [];

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const value of items) {
                if (Array.isArray(value) && value.length > 1 && (value[0] as string).includes("%c")) {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    logMessage += value[0];
                    css.push(...value.slice(1));
                } else {
                    arguments_.push(value);
                }
            }

            consoleLogFunction(logMessage + "%c", ...css, "", ...arguments_);
        }
    }

    private _formatLabel(label: string): string {
        let formattedLabel = this._styles.uppercase.label ? label.toUpperCase() : label;

        formattedLabel = this._styles.underline.label ? underline(formattedLabel) : formattedLabel;

        if (this._styles.bold.label) {
            formattedLabel = bold(formattedLabel);
        }

        return formattedLabel;
    }
}
