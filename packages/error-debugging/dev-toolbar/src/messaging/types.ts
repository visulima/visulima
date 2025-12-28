/**
 * Internal messaging types
 */

/**
 * Message envelope for transport
 */
export interface MessageEnvelope<T = any> {
  /**
   * Message ID for request/response correlation
   */
  id?: string;

  /**
   * Event/method name
   */
  event: string;

  /**
   * Message data
   */
  data?: T;

  /**
   * Timestamp
   */
  timestamp?: number;
}

/**
 * Message handler function
 */
export type MessageHandler<T = any> = (data: T, envelope: MessageEnvelope<T>) => void | Promise<void>;

/**
 * Message handlers map
 */
export type MessageHandlers = Map<string, Set<MessageHandler>>;
