import EmailError from "../../errors/email-error";
import type { EmailAddress, EmailResult, Result } from "../../types";
import generateMessageId from "../../utils/generate-message-id";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import validateEmailOptions from "../../utils/validation/validate-email-options";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";
import { createProviderLogger, createStandardAttachment, handleProviderError, ProviderState } from "../utils";
import { createTokenResolver, DEFAULT_AUTHORITY, resolveAuth } from "./auth";
import type { Outlook365Config, Outlook365EmailOptions } from "./types";

const PROVIDER_NAME = "outlook365";
const DEFAULT_ENDPOINT = "https://graph.microsoft.com/v1.0";
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

const toAddressList = (addresses: EmailAddress | EmailAddress[]): EmailAddress[] => [addresses].flat();

const toGraphRecipients = (addresses: EmailAddress[]): { emailAddress: { address: string; name?: string } }[] =>
    addresses.map((address) => {
        return { emailAddress: { address: address.email, ...address.name ? { name: address.name } : {} } };
    });

/**
 * Converts a token-acquisition failure into an {@link EmailError}.
 *
 * The built-in flows already throw a descriptive EmailError (e.g. the AADSTS code from Azure AD)
 * — re-wrapping it would bury the diagnostic. Anything else (a transport error, a throwing
 * `getAccessToken`) keeps its message.
 * @param error The thrown value.
 * @returns The error to report.
 */
const toTokenError = (error: unknown): EmailError => {
    if (error instanceof EmailError) {
        return error;
    }

    const reason = error instanceof Error ? error.message : String(error);

    return new EmailError(PROVIDER_NAME, `Failed to obtain access token: ${reason}`, { cause: error });
};

/**
 * The publicly readable `provider.options` — every option the provider defaults is guaranteed
 * present, and every credential is omitted.
 */
type ResolvedOptions = Omit<Outlook365Config, "accessToken" | "clientSecret" | "getAccessToken" | "onRefreshToken" | "refreshToken">
    & Required<Pick<Outlook365Config, "debug" | "endpoint" | "retries" | "saveToSentItems" | "timeout" | "userId">>;

/**
 * Outlook365 provider — sends email through the Microsoft Graph `sendMail` endpoint.
 *
 * Authenticates with a caller-supplied token (`accessToken` / `getAccessToken`), the delegated
 * refresh-token flow, or the app-only client-credentials flow. See {@link Outlook365Config}.
 */
const outlook365Provider: ProviderFactory<Outlook365Config, unknown, Outlook365EmailOptions> = defineProvider<
    Outlook365Config,
    unknown,
    Outlook365EmailOptions
>((config: Outlook365Config = {}) => {
    const logger = createProviderLogger(PROVIDER_NAME, config.logger);

    // Throws unless exactly one flow's credentials are present.
    const auth = resolveAuth(config, PROVIDER_NAME, logger);

    // App-only tokens belong to the application, not a user, so Graph rejects `/me` with
    // "/me request is only valid with delegated authentication flow".
    if (auth.mode === "clientCredentials" && (config.userId === undefined || config.userId === "me")) {
        throw new EmailError(PROVIDER_NAME, "The app-only (client credentials) flow requires an explicit 'userId'", {
            hint: "Set 'userId' to the sender's mailbox id or UPN — app-only tokens have no 'me' mailbox.",
        });
    }

    // Credentials are deliberately kept out of `options`: it is a public field, so a crash
    // reporter or a `console.log(provider.options)` would otherwise dump a client secret. The
    // resolver closes over `config` instead, which also keeps it immune to mutations here.
    const options: ResolvedOptions = {
        authMode: auth.mode,
        authority: config.authority ?? DEFAULT_AUTHORITY,
        clientId: config.clientId,
        debug: config.debug ?? false,
        endpoint: config.endpoint ?? DEFAULT_ENDPOINT,
        logger: config.logger,
        now: config.now,
        retries: config.retries ?? DEFAULT_RETRIES,
        saveToSentItems: config.saveToSentItems ?? true,
        scopes: config.scopes,
        tenantId: config.tenantId,
        timeout: config.timeout ?? DEFAULT_TIMEOUT,
        tokenRefreshSkewMs: config.tokenRefreshSkewMs,
        userId: config.userId ?? "me",
    };

    const providerState = new ProviderState();
    const resolveToken = createTokenResolver(auth, config, PROVIDER_NAME, logger);

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

        // eslint-disable-next-line @typescript-eslint/require-await
        async initialize(): Promise<void> {
            providerState.setInitialized();
        },

        // eslint-disable-next-line @typescript-eslint/require-await
        async isAvailable(): Promise<boolean> {
            // Always true: the factory throws unless a flow's credentials are present. Reaching
            // the token endpoint is `validateCredentials`'s job.
            return true;
        },

        name: PROVIDER_NAME,

        options,

        async sendEmail(emailOptions: Outlook365EmailOptions): Promise<Result<EmailResult>> {
            try {
                const validationErrors = validateEmailOptions(emailOptions);

                if (validationErrors.length > 0) {
                    return { error: new EmailError(PROVIDER_NAME, `Invalid email options: ${validationErrors.join(", ")}`), success: false };
                }

                let accessToken: string;

                try {
                    accessToken = await resolveToken();
                } catch (error) {
                    return { error: toTokenError(error), success: false };
                }

                const message: Record<string, unknown> = {
                    body: { content: emailOptions.html ?? emailOptions.text ?? "", contentType: emailOptions.html ? "HTML" : "Text" },
                    subject: emailOptions.subject,
                    toRecipients: toGraphRecipients(toAddressList(emailOptions.to)),
                };

                if (emailOptions.cc) {
                    message.ccRecipients = toGraphRecipients(toAddressList(emailOptions.cc));
                }

                if (emailOptions.bcc) {
                    message.bccRecipients = toGraphRecipients(toAddressList(emailOptions.bcc));
                }

                if (emailOptions.replyTo) {
                    message.replyTo = toGraphRecipients(toAddressList(emailOptions.replyTo));
                }

                if (emailOptions.importance) {
                    message.importance = emailOptions.importance;
                }

                if (emailOptions.attachments && emailOptions.attachments.length > 0) {
                    message.attachments = await Promise.all(
                        emailOptions.attachments.map(async (attachment) => {
                            const standard = await createStandardAttachment(attachment, PROVIDER_NAME);

                            return {
                                "@odata.type": "#microsoft.graph.fileAttachment",
                                contentBytes: standard.content,
                                contentType: standard.contentType,
                                name: standard.filename,
                            };
                        }),
                    );
                }

                const userPath = options.userId === "me" ? "me" : `users/${options.userId}`;

                const result = await retry(
                    async () =>
                        makeRequest(
                            `${options.endpoint}/${userPath}/sendMail`,
                            {
                                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                                method: "POST",
                                timeout: options.timeout,
                            },
                            JSON.stringify({ message, saveToSentItems: options.saveToSentItems }),
                        ),
                    options.retries,
                );

                if (!result.success) {
                    return { error: result.error ?? new EmailError(PROVIDER_NAME, "Failed to send email"), success: false };
                }

                // Graph sendMail returns 202 Accepted with an empty body — synthesise an id.
                return {
                    data: { messageId: generateMessageId(), provider: PROVIDER_NAME, response: result.data, sent: true, timestamp: new Date() },
                    success: true,
                };
            } catch (error) {
                return { error: handleProviderError(PROVIDER_NAME, "send email", error, logger), success: false };
            }
        },

        async validateCredentials(): Promise<boolean> {
            // For the built-in flows this round-trips the Azure AD token endpoint; for a
            // caller-supplied token it only confirms the source resolves.
            try {
                await resolveToken();

                return true;
            } catch (error) {
                // Warn, not debug: the boolean throws away the AADSTS reason, so this log is the
                // only place it survives.
                logger.warn(`Credential validation failed: ${error instanceof Error ? error.message : String(error)}`);

                return false;
            }
        },
    };
});

export default outlook365Provider;
