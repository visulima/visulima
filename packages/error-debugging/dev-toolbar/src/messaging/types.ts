/**
 * Internal messaging types
 */

/**
 * Message envelope for transport
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MessageEnvelope<T = any> {
    /**
     * Message data
     */
    data?: T;

    /**
     * Event/method name
     */
    event: string;

    /**
     * Message ID for request/response correlation
     */
    id?: string;

    /**
     * Timestamp
     */
    timestamp?: number;
}

/**
 * Message handler function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageHandler<T = any> = (data: T, envelope: MessageEnvelope<T>) => void | Promise<void>;

/**
 * Message handlers map
 */
export type MessageHandlers = Map<string, Set<MessageHandler>>;
