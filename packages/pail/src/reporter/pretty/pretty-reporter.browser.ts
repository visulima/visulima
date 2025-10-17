import colorize, { bold, grey, underline, white } from "@visulima/colorize/browser";
import { format } from "@visulima/fmt";

import { EMPTY_SYMBOL } from "../../constants";
import type { ReadonlyMeta } from "../../types";
import getLongestBadge from "../../utils/get-longest-badge";
import getLongestLabel from "../../utils/get-longest-label";
import writeConsoleLogBasedOnLevel from "../../utils/write-console-log-based-on-level";
import type { PrettyStyleOptions } from "./abstract-pretty-reporter";
import { AbstractPrettyReporter } from "./abstract-pretty-reporter";

/**
 * Browser Pretty Reporter.
 *
 * A pretty-printing reporter for browser environments that formats log messages
 * with colors and structured layout for console output. Uses browser-compatible
 * color formatting and console APIs.
 * @template T - Custom logger type names
 * @template L - Log level types
 * @example
 * ```typescript
 * import { createPail } from "@visulima/pail";
 *
 * const logger = createPail({
 *   reporters: [new PrettyReporter({
 *     bold: { label: true },
 *     uppercase: { label: true }
 *   })]
 * });
 *
 * logger.info("Application started");
 * logger.error("Something went wrong", error);
 * ```
 */
class PrettyReporter<T extends string = string, L extends string = string> extends AbstractPrettyReporter<T, L> {
    /**
     * Creates a new Browser Pretty Reporter instance.
     * @param options Styling options for pretty formatting
     */
    public constructor(options: Partial<PrettyStyleOptions> = {}) {
        super({
            uppercase: {
                label: true,
                ...options.uppercase,
            },
            ...options,
        });
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public log(meta: ReadonlyMeta<L>): void {
        // eslint-disable-next-line unicorn/no-typeof-undefined
        const isNotBrowser = typeof globalThis.window !== "undefined" && typeof globalThis.document !== "undefined";
        const consoleLogFunction = writeConsoleLogBasedOnLevel(meta.type.level);

        const { badge, context, date, error, groups, label, message, prefix, repeated, scope, suffix, type } = meta;

        const { color } = this.loggerTypes[type.name as keyof typeof this.loggerTypes];

        const colorized = color ? colorize[color] : white;

        const items = [];

        if (isNotBrowser && groups.length > 0) {
            const groupSpaces: string = groups.map(() => "   ").join("");
            const cGroup = grey(`[${groups.at(-1) as string}]`);

            items.push(format(groupSpaces + (cGroup[0] as string), cGroup.slice(1) as unknown as string[]));
        }

        if (date) {
            const cDate = grey(this.styles.dateFormatter(typeof date === "string" ? new Date(date) : date));

            if (isNotBrowser) {
                items.push(format(cDate[0] as string, cDate.slice(1) as unknown as string[]));
            } else {
                items.push([`${cDate[0] as string} `, ...cDate.slice(1)]);
            }
        }

        if (badge) {
            const cBadge = colorized(badge);

            if (isNotBrowser) {
                items.push(format(cBadge[0] as string, cBadge.slice(1) as unknown as string[]));
            } else {
                items.push([`${cBadge[0]} `, ...cBadge.slice(1)]);
            }
        } else {
            const longestBadge: string = getLongestBadge<L, T>(this.loggerTypes);

            if (longestBadge.length > 0) {
                const cBadgePlaceholder = grey(".".repeat(longestBadge.length));

                if (isNotBrowser) {
                    items.push(format(`${cBadgePlaceholder[0] as string} `, cBadgePlaceholder.slice(1) as unknown as string[]));
                } else {
                    items.push([`${cBadgePlaceholder[0] as string} `, ...cBadgePlaceholder.slice(1)]);
                }
            }
        }

        const longestLabel = getLongestLabel<L, T>(this.loggerTypes);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let repeatedMessage: any[] | string | undefined;

        if (repeated) {
            const cRepeated = white(`[${repeated}x]`);

            repeatedMessage = isNotBrowser
                ? (format(cRepeated[0] as string, cRepeated.slice(1) as unknown as string[]) as string)
                : [cRepeated[0], ...cRepeated.slice(1)];
        }

        if (label) {
            const cLabel = colorized(this.#formatLabel(label as string));

            if (isNotBrowser) {
                items.push(format(cLabel[0] as string, cLabel.slice(1) as unknown as string[]));
            } else {
                items.push([cLabel[0], ...cLabel.slice(1)]);
            }

            if (repeatedMessage) {
                items.push(repeatedMessage);
            }

            let lengthDiff = (longestLabel as string).length - (label as string).length;

            if (repeated) {
                lengthDiff -= String(repeated).length + 3;
            } else {
                lengthDiff += 1;
            }

            if (lengthDiff > 0) {
                const cLabelSpacer = grey(".".repeat(lengthDiff));

                if (isNotBrowser) {
                    items.push(format(cLabelSpacer[0] as string, cLabelSpacer.slice(1) as unknown as string[]));
                } else {
                    items.push([` ${cLabelSpacer[0]}`, ...cLabelSpacer.slice(1)]);
                }
            }
        } else {
            const cSpacer = grey(".".repeat((longestLabel as string).length + 1));

            if (isNotBrowser) {
                items.push(format(cSpacer[0] as string, cSpacer.slice(1) as unknown as string[]));
            } else {
                items.push([cSpacer[0], ...cSpacer.slice(1)]);
            }
        }

        if (Array.isArray(scope) && scope.length > 0) {
            const cScope = grey(`[${scope.join(" > ")}]`);

            if (isNotBrowser) {
                items.push(format(cScope[0] as string, cScope.slice(1) as unknown as string[]));
            } else {
                items.push([cScope[0], ...cScope.slice(1)]);
            }
        }

        if (prefix) {
            const cPrefix = grey(
                `${Array.isArray(scope) && scope.length > 0 ? ". " : " "}[${this.styles.underline.prefix ? underline(prefix as string) : prefix}] `,
            );

            if (isNotBrowser) {
                items.push(format(cPrefix[0] as string, cPrefix.slice(1) as unknown as string[]));
            } else {
                items.push([cPrefix[0] as string, ...cPrefix.slice(1)]);
            }
        }

        if (message !== EMPTY_SYMBOL) {
            items.push(message);
        }

        if (context) {
            items.push(...context);
        }

        if (error) {
            items.push(error, "\n\n");
        }

        if (suffix) {
            const cSuffix = grey((this.styles.underline.suffix ? underline(suffix as string) : suffix) as string);

            if (isNotBrowser) {
                items.push(format(`\n${cSuffix[0] as string}` as string, cSuffix.slice(1) as unknown as string[]));
            } else {
                items.push([`\n${cSuffix[0] as string}` as string, ...cSuffix.slice(1)]);
            }
        }

        if (isNotBrowser) {
            consoleLogFunction(...items);
        } else {
            let logMessage = "";

            const css = [];
            // eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
            const arguments_ = [];

            for (const value of items) {
                if (Array.isArray(value) && value.length > 1 && (value[0] as string).includes("%c")) {
                    logMessage += value[0];

                    css.push(...value.slice(1));
                } else {
                    arguments_.push(value);
                }
            }

            consoleLogFunction(`${logMessage}%c`, ...css, "", ...arguments_);
        }
    }

    /**
     * Formats a label according to styling options.
     * @param label The label to format
     * @returns The formatted label string
     * @private
     */
    #formatLabel(label: string): string {
        let formattedLabel = this.styles.uppercase.label ? label.toUpperCase() : label;

        formattedLabel = this.styles.underline.label ? underline(formattedLabel) : formattedLabel;

        if (this.styles.bold.label) {
            formattedLabel = bold(formattedLabel);
        }

        return formattedLabel;
    }
}

export default PrettyReporter;
