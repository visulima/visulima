import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { EmailOptions, EmailResult, Result } from "../../types";
import applyMessageId from "../../utils/apply-message-id";
import buildMimeMessage from "../../utils/build-mime-message";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import type { FileConfig } from "./types";

const PROVIDER_NAME = "file";
const MAX_STEM_LENGTH = 100;

/**
 * Turns a Message-ID into a filename stem. Anything outside a conservative set is replaced, so a
 * caller-supplied id cannot introduce a path separator.
 * @param messageId The resolved Message-ID, angle brackets included.
 * @returns A filename-safe stem.
 */
const toFileStem = (messageId: string): string => messageId.replaceAll(/[<>]/g, "").replaceAll(/[^\w.@+-]/g, "_").slice(0, MAX_STEM_LENGTH);

/**
 * File Provider that writes each message as an `.eml` file instead of sending it.
 *
 * Useful for development and for test suites that need to inspect the exact MIME output.
 * Files are named after the send time in epoch milliseconds and the message id, with an `.eml`
 * extension, and are never overwritten. Bcc recipients are written into the file, since nothing
 * is delivered and the file is the only record of them.
 */
const fileProvider: ProviderFactory<FileConfig> = defineProvider((config?: FileConfig) => {
    if (!config?.directory) {
        throw new RequiredOptionError(PROVIDER_NAME, "directory");
    }

    const directory = resolve(config.directory);

    return {
        features: {
            attachments: true,
            batchSending: false,
            customHeaders: true,
            html: true,
            replyTo: true,
            scheduling: false,
            tagging: false,
            templates: false,
            tracking: false,
        },

        /**
         * Creates the output directory.
         */
        async initialize(): Promise<void> {
            await mkdir(directory, { recursive: true });
        },

        /**
         * The file provider is available when the output directory exists or can be created.
         * @returns True when the directory is usable, false otherwise.
         */
        async isAvailable(): Promise<boolean> {
            try {
                await mkdir(directory, { recursive: true });

                return true;
            } catch {
                return false;
            }
        },

        name: PROVIDER_NAME,

        options: config,

        /**
         * Writes the message to the output directory as an `.eml` file.
         * @param emailOptions The email options to write.
         * @returns The Message-ID and the written file path, or an error when the file cannot be created.
         */
        async sendEmail(emailOptions: EmailOptions): Promise<Result<EmailResult>> {
            const validationErrors = validateEmailOptions(emailOptions);

            if (validationErrors.length > 0) {
                return {
                    error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`),
                    success: false,
                };
            }

            const { headers, messageId } = applyMessageId(emailOptions);
            const timestamp = new Date();
            const eml = await buildMimeMessage({ ...emailOptions, headers }, { includeBcc: true });
            const name = `${String(timestamp.getTime())}-${toFileStem(messageId)}.eml`;
            const path = resolve(directory, name);

            // Defence in depth: toFileStem already removes separators, so this only fails if that changes.
            if (dirname(path) !== directory) {
                return {
                    error: new EmailError(PROVIDER_NAME, "Message-ID resolves outside the output directory"),
                    success: false,
                };
            }

            try {
                await mkdir(directory, { recursive: true });
                await writeFile(path, eml, { encoding: "utf8", flag: "wx" });
            } catch (error) {
                const reason = error instanceof Error && "code" in error && error.code === "EEXIST" ? "a file with this name already exists" : String(error);

                return {
                    error: new EmailError(PROVIDER_NAME, `Failed to write ${name}: ${reason}`),
                    success: false,
                };
            }

            return {
                data: {
                    messageId,
                    provider: PROVIDER_NAME,
                    response: { path },
                    sent: true,
                    timestamp,
                },
                success: true,
            };
        },
    };
});

export default fileProvider;
