import { createInterface } from "node:readline";
import { styleText } from "node:util";

import type { EnsurePackagesOptions } from "../types";

type ConfirmOptions = EnsurePackagesOptions["confirm"] & { message: string };

/**
 * Creates a styled confirmation prompt using readline.
 * @param options Configuration options for the confirmation prompt
 * @returns A promise that resolves to true if confirmed, false otherwise
 */
const confirm = async (options: ConfirmOptions): Promise<boolean> => {
    const { default: defaultValue = false, message, transformer } = options;

    const formatMessage = (message_: string): string => {
        // Style the message with a beautiful theme - cyan question mark, bold message, gray hints
        const questionMark = styleText(["cyan", "bold"], "?");
        const boldMessage = styleText(["bold"], message_);
        const defaultHint = defaultValue ? `${styleText(["greenBright"], "Y")}${styleText(["gray"], "/n")}` : `y/${styleText(["yellowBright"], "N")}`;

        return `${questionMark} ${boldMessage} ${styleText(["gray"], `(${defaultHint})`)}`;
    };

    const formatAnswer = (answer: boolean): string => {
        if (transformer) {
            return transformer(answer);
        }

        // Beautiful colored answers with checkmarks
        return answer ? styleText(["greenBright"], "Yes") : styleText(["yellowBright"], "No");
    };

    return new Promise<boolean>((resolve) => {
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const formattedMessage = formatMessage(message);

        rl.question(formattedMessage, (answer: string) => {
            rl.close();

            const normalizedAnswer = answer.trim().toLowerCase();

            if (normalizedAnswer === "") {
                resolve(defaultValue);

                return;
            }

            if (normalizedAnswer === "y" || normalizedAnswer === "yes") {
                // eslint-disable-next-line no-console
                console.log(`${styleText(["greenBright"], "✓")} ${formatAnswer(true)}`);
                resolve(true);

                return;
            }

            if (normalizedAnswer === "n" || normalizedAnswer === "no") {
                // eslint-disable-next-line no-console
                console.log(`${styleText(["yellowBright"], "✗")} ${formatAnswer(false)}`);
                resolve(false);

                return;
            }

            // Invalid input, use default
            // eslint-disable-next-line no-console
            console.log(`${styleText(["gray"], "→")} ${formatAnswer(defaultValue)}`);
            resolve(defaultValue);
        });

        // Handle Ctrl+C gracefully
        rl.on("SIGINT", () => {
            rl.close();
            // eslint-disable-next-line no-console
            console.log(`\n${styleText(["gray"], "→")} ${formatAnswer(defaultValue)}`);
            resolve(defaultValue);
        });
    });
};

export default confirm;
