import NotificationError from "../../errors/notification-error";
import type { BaseNotificationPayload, NotificationResult, Result } from "../../types";
import type { Provider } from "../provider";

export interface RoundRobinConfig {
    /** When true, falls through to the next provider on failure (default true). */
    failover?: boolean;
    /** Provider id reported on results (default `"roundrobin"`). */
    id?: string;
}

/**
 * Wraps several same-channel providers and distributes sends across them in rotation.
 * Optionally falls over to the next provider on failure.
 * @param providers The providers to balance across.
 * @param config Optional config.
 * @returns A composite provider.
 */
export const roundRobinProvider = <PayloadT extends BaseNotificationPayload>(
    providers: Provider<unknown, PayloadT>[],
    config: RoundRobinConfig = {},
): Provider<unknown, PayloadT> => {
    if (providers.length === 0) {
        throw new NotificationError("roundrobin", "At least one provider is required");
    }

    const id = config.id ?? "roundrobin";
    const failover = config.failover ?? true;
    const first = providers[0] as Provider<unknown, PayloadT>;
    let cursor = 0;

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
            const start = cursor;

            cursor = (cursor + 1) % providers.length;

            const errors: string[] = [];
            const attempts = failover ? providers.length : 1;

            for (let offset = 0; offset < attempts; offset += 1) {
                const provider = providers[(start + offset) % providers.length] as Provider<unknown, PayloadT>;
                // eslint-disable-next-line no-await-in-loop
                const result = await provider.send(payload);

                if (result.success) {
                    return result;
                }

                errors.push(`${provider.id}: ${result.error instanceof Error ? result.error.message : String(result.error)}`);
            }

            return { error: new NotificationError(id, `Send failed: ${errors.join("; ")}`), success: false };
        },
    };
};
