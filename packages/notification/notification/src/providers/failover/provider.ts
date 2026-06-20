import NotificationError from "../../errors/notification-error";
import type { BaseNotificationPayload, NotificationResult, Result } from "../../types";
import type { Provider } from "../provider";

export interface FailoverConfig {
    /** Provider id reported on results (default `"failover"`). */
    id?: string;
    /** Logger for failover transitions. */
    logger?: Console;
}

/**
 * Wraps several same-channel providers and tries each in order until one succeeds.
 * @param providers The providers to fail over between (highest priority first).
 * @param config Optional config.
 * @returns A composite provider.
 */
export const failoverProvider = <PayloadT extends BaseNotificationPayload>(
    providers: Provider<unknown, PayloadT>[],
    config: FailoverConfig = {},
): Provider<unknown, PayloadT> => {
    if (providers.length === 0) {
        throw new NotificationError("failover", "At least one provider is required");
    }

    const id = config.id ?? "failover";
    const first = providers[0] as Provider<unknown, PayloadT>;

    return {
        channel: first.channel,
        id,
        initialize: async () => {
            await Promise.all(providers.map(async (provider) => provider.initialize()));
        },
        isAvailable: async () => {
            const checks = await Promise.all(providers.map(async (provider) => provider.isAvailable()));

            return checks.some(Boolean);
        },
        send: async (payload: PayloadT): Promise<Result<NotificationResult>> => {
            const errors: string[] = [];

            for (const provider of providers) {
                // eslint-disable-next-line no-await-in-loop
                const result = await provider.send(payload);

                if (result.success) {
                    return result;
                }

                const message = result.error instanceof Error ? result.error.message : String(result.error);

                errors.push(`${provider.id}: ${message}`);
                config.logger?.warn(`[@visulima/notification] [${id}] provider "${provider.id}" failed, trying next`);
            }

            return { error: new NotificationError(id, `All ${String(providers.length)} providers failed: ${errors.join("; ")}`), success: false };
        },
    };
};
