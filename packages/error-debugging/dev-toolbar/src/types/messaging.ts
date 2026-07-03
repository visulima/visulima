/**
 * Message channel interface for bidirectional communication
 */
export interface MessageChannel<TEvents extends Record<string, (...args: any[]) => void>> {
    /**
     * Unsubscribe from an event
     * @param event Event name
     * @param handler Optional specific handler to remove
     */
    off: <K extends keyof TEvents>(event: K, handler?: TEvents[K]) => void;

    /**
     * Subscribe to an event
     * @param event Event name
     * @param handler Event handler
     * @returns Unsubscribe function
     */
    on: <K extends keyof TEvents>(event: K, handler: TEvents[K]) => () => void;

    /**
     * Subscribe to an event once
     * @param event Event name
     * @param handler Event handler
     */
    once: <K extends keyof TEvents>(event: K, handler: TEvents[K]) => void;

    /**
     * Send a message/event
     * @param event Event name
     * @param data Event data
     */
    send: <K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>) => void;
}

/**
 * Channel factory function
 */
export type ChannelFactory<TEvents extends Record<string, (...args: any[]) => void>> = () => MessageChannel<TEvents>;

/**
 * Factory result providing a method to instantiate named message channels.
 */
export interface MessageChannelContext<TEvents extends Record<string, (...args: any[]) => void>> {
    /**
     * Creates and returns a new channel instance.
     */
    createChannel: () => MessageChannel<TEvents>;
}
