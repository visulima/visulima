import type { ChannelPayloadMap, Notification, NotificationMessage } from "../notification";
import type { ChannelType, MaybePromise, Receipt } from "../types";

const orderedChannels = (message: NotificationMessage, order?: ChannelType[]): ChannelType[] => {
    const present = Object.keys(message) as ChannelType[];

    if (!order) {
        return present;
    }

    const ordered = order.filter((channel) => present.includes(channel));
    const rest = present.filter((channel) => !order.includes(channel));

    return [...ordered, ...rest];
};

/**
 * A gate decides whether a channel should be attempted for a given payload. Use it for
 * preferences, capability checks, send-windows or arbitrary conditions.
 */
export type ChannelGate = (channel: ChannelType, payload: ChannelPayloadMap[ChannelType]) => MaybePromise<boolean>;

export interface RouteOptions {
    /**
     * Optional gate run before each channel send. Returning false skips the channel.
     */
    gate?: ChannelGate;

    /**
     * `"best-of"` (default) sends in `order` and stops at the first success;
     * `"all"` broadcasts to every present, gated channel in parallel.
     */
    mode?: "all" | "best-of";

    /**
     * Channel priority order. Channels absent from the message are skipped; channels in
     * the message but absent from `order` are appended in object order.
     */
    order?: ChannelType[];
}

/**
 * Routes a multi-channel message across channels with a priority order and an optional
 * gate. `"best-of"` stops at the first success (channel fallback); `"all"` broadcasts.
 * @param notification The facade used to send.
 * @param message The multi-channel message.
 * @param options Routing options.
 * @returns The receipts produced (one per attempted channel).
 */
export const route = async (notification: Notification, message: NotificationMessage, options: RouteOptions = {}): Promise<Receipt[]> => {
    const mode = options.mode ?? "best-of";
    const channels = orderedChannels(message, options.order);

    const allowed: ChannelType[] = [];

    for (const channel of channels) {
        const payload = message[channel] as ChannelPayloadMap[ChannelType];

        if (options.gate) {
            // eslint-disable-next-line no-await-in-loop
            const permitted = await options.gate(channel, payload);

            if (!permitted) {
                continue;
            }
        }

        allowed.push(channel);
    }

    if (mode === "all") {
        return Promise.all(allowed.map(async (channel) => notification.sendToChannel(channel, message[channel] as ChannelPayloadMap[ChannelType])));
    }

    const receipts: Receipt[] = [];

    for (const channel of allowed) {
        // eslint-disable-next-line no-await-in-loop
        const receipt = await notification.sendToChannel(channel, message[channel] as ChannelPayloadMap[ChannelType]);

        receipts.push(receipt);

        if (receipt.successful) {
            break;
        }
    }

    return receipts;
};
