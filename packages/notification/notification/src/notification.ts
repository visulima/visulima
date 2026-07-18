import NotificationError from "./errors/notification-error";
import type { Middleware, SendContext, SendFunction } from "./middleware/types";
import { composeMiddleware } from "./middleware/types";
import type { Provider } from "./providers/provider";
import type {
    ChannelType,
    ChatPayload,
    EmailChannelPayload,
    InAppPayload,
    MaybePromise,
    NotificationResult,
    PushPayload,
    Receipt,
    Result,
    SmsPayload,
    WebhookPayload,
} from "./types";

const toReceipt = (result: Result<NotificationResult>, channel: ChannelType, provider: string): Receipt => {
    if (result.success && result.data) {
        return {
            channel,
            messageId: result.data.messageId,
            provider: result.data.provider ?? provider,
            response: result.data.response,
            successful: true,
            timestamp: result.data.timestamp,
        };
    }

    const { error } = result;
    let message: string;

    if (error instanceof Error) {
        message = error.message;
    } else if (error === undefined || error === null) {
        message = "Unknown error";
    } else if (typeof error === "string") {
        message = error;
    } else {
        message = JSON.stringify(error);
    }

    return { channel, errorMessages: [message], provider, successful: false };
};

/**
 * Maps each channel to its payload type.
 */
export interface ChannelPayloadMap {
    chat: ChatPayload;
    email: EmailChannelPayload;
    inapp: InAppPayload;
    push: PushPayload;
    sms: SmsPayload;
    webhook: WebhookPayload;
}

/**
 * A multi-channel message: a payload per channel to deliver on.
 */
export type NotificationMessage = {
    [K in ChannelType]?: ChannelPayloadMap[K];
};

/**
 * Providers registered per channel.
 */
export type NotificationProviders = {
    [K in ChannelType]?: Provider<unknown, ChannelPayloadMap[K]>;
};

export interface SendManyOptions {
    /** Maximum number of messages delivered concurrently (default 10). */
    concurrency?: number;
}

/**
 * The high-level multi-channel notification facade. Holds a provider per channel,
 * a shared middleware chain and dispatches messages across channels.
 */
export class Notification {
    readonly #providers: NotificationProviders;

    readonly #middlewares: Middleware[] = [];

    readonly #initialized = new Map<string, Promise<void>>();

    #logger: Console | undefined;

    public constructor(providers: NotificationProviders) {
        this.#providers = providers;
    }

    /**
     * Registers a middleware. First registered runs outermost.
     * @param middleware The middleware to add.
     * @returns This instance for chaining.
     */
    public use(middleware: Middleware): this {
        this.#middlewares.push(middleware);

        return this;
    }

    /**
     * Sets a logger used by the facade.
     * @param logger The console-like logger.
     * @returns This instance for chaining.
     */
    public setLogger(logger: Console): this {
        this.#logger = logger;

        return this;
    }

    /**
     * Returns the provider registered for a channel, if any.
     * @param channel The channel whose registered provider should be looked up.
     * @returns The provider or undefined.
     */
    public getProvider(channel: ChannelType): Provider | undefined {
        return this.#providers[channel] as Provider | undefined;
    }

    /**
     * Sends a payload on a single channel.
     * @param channel The target channel.
     * @param payload The channel-specific payload to deliver.
     * @returns A receipt describing the outcome.
     */
    public async sendToChannel<K extends ChannelType>(channel: K, payload: ChannelPayloadMap[K]): Promise<Receipt> {
        const provider = this.#providers[channel] as Provider | undefined;

        if (!provider) {
            return { channel, errorMessages: [`No provider registered for channel "${channel}"`], successful: false };
        }

        try {
            await this.#ensureInitialized(provider);
        } catch (error) {
            return toReceipt({ error, success: false }, channel, provider.id);
        }

        const terminal: SendFunction = async (context: SendContext) => provider.send(context.payload);

        const send = composeMiddleware(this.#middlewares, terminal);

        try {
            const result = await send({ channel, payload, provider: provider.id });

            return toReceipt(result, channel, provider.id);
        } catch (error) {
            return toReceipt({ error, success: false }, channel, provider.id);
        }
    }

    /**
     * Sends a multi-channel message, delivering each present channel in parallel.
     * @param message The multi-channel message.
     * @returns One receipt per attempted channel.
     */
    public async send(message: NotificationMessage): Promise<Receipt[]> {
        const channels = Object.keys(message) as ChannelType[];

        if (channels.length === 0) {
            throw new NotificationError("notification", "send() called with an empty message");
        }

        return Promise.all(channels.map(async (channel) => this.sendToChannel(channel, message[channel] as ChannelPayloadMap[ChannelType])));
    }

    /**
     * Sends many messages with bounded concurrency, yielding the receipts for each.
     * @param messages The messages to send.
     * @param options Concurrency options.
     * @yields The receipts for each message, in completion order.
     */
    public async* sendMany(messages: Iterable<NotificationMessage>, options: SendManyOptions = {}): AsyncGenerator<Receipt[]> {
        const concurrency = Math.max(1, options.concurrency ?? 10);
        const queue = [...messages];
        let index = 0;

        while (index < queue.length) {
            const batch = queue.slice(index, index + concurrency);

            index += concurrency;

            // eslint-disable-next-line no-await-in-loop
            const results = await Promise.all(batch.map(async (message) => this.send(message)));

            for (const result of results) {
                yield result;
            }
        }
    }

    /**
     * Initializes every registered provider.
     */
    public async initialize(): Promise<void> {
        await Promise.all(Object.values(this.#providers).map(async (provider) => this.#ensureInitialized(provider as Provider)));
    }

    /**
     * Shuts down every registered provider that supports it.
     */
    public async shutdown(): Promise<void> {
        await Promise.all(
            Object.values(this.#providers).map(async (provider) => {
                const { shutdown } = provider as Provider;

                if (shutdown) {
                    await shutdown();
                }
            }),
        );
    }

    async #ensureInitialized(provider: Provider): Promise<void> {
        const existing = this.#initialized.get(provider.id);

        if (existing) {
            await existing;

            return;
        }

        const promise = (async () => {
            const init: MaybePromise<void> = provider.initialize();

            await init;

            this.#logger?.debug(`[@visulima/notification] initialized provider "${provider.id}"`);
        })();

        this.#initialized.set(provider.id, promise);

        try {
            await promise;
        } catch (error) {
            this.#initialized.delete(provider.id);

            throw error;
        }
    }
}

/**
 * Creates a {@link Notification} facade from a map of channel providers.
 * @param providers Providers keyed by channel.
 * @returns A configured notification facade.
 */
export const createNotification = (providers: NotificationProviders): Notification => new Notification(providers);

/**
 * One-shot send through a single provider — the quickest path for a single-channel
 * send without wiring a {@link Notification} facade. For multiple channels,
 * middleware, routing or reuse, use {@link createNotification}.
 * @param channel The channel to deliver on.
 * @param provider The provider to deliver through.
 * @param payload The channel-specific payload.
 * @returns The send {@link Receipt}.
 * @example
 * ```ts
 * import { send } from "@visulima/notification";
 * import { twilioProvider } from "@visulima/notification/providers/twilio";
 *
 * await send("sms", twilioProvider({ accountSid, authToken, from }), { to: "+15555550100", text: "Hi" });
 * ```
 */
export const send = async <ChannelT extends ChannelType>(
    channel: ChannelT,
    provider: Provider<unknown, ChannelPayloadMap[ChannelT]>,
    payload: ChannelPayloadMap[ChannelT],
): Promise<Receipt> => new Notification({ [channel]: provider }).sendToChannel(channel, payload);
