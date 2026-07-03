import type { BaseConfig } from "../../../types";

/**
 * A W3C Push API subscription. The `to` field of a push payload carries one of these
 * (as an object, or its JSON string form) when targeting the web-push provider.
 */
export interface PushSubscriptionLike {
    /** The push service endpoint URL the encrypted payload is delivered to. */
    endpoint: string;
    /** The subscription's client public key (`p256dh`) and auth secret (`auth`), base64url. */
    keys: {
        auth: string;
        p256dh: string;
    };
}

export interface WebPushConfig extends BaseConfig {
    /** Time-to-live in seconds the push service should retain the message (default 2419200). */
    ttl?: number;
    /** Default delivery urgency hint (`very-low` | `low` | `normal` | `high`). */
    urgency?: "high" | "low" | "normal" | "very-low";
    /** Application server private VAPID key (base64url, raw P-256 scalar `d`). */
    vapidPrivateKey: string;
    /** Application server public VAPID key (base64url, uncompressed P-256 point). */
    vapidPublicKey: string;
    /** VAPID `sub` claim — a `mailto:` or `https:` contact for the app server. */
    vapidSubject: string;
}
