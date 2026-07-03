import type { FeatureFlags } from "../../types";
import type { Provider, ProviderFactory } from "../provider";

const FEATURE_KEYS: (keyof FeatureFlags)[] = [
    "attachments",
    "batchSending",
    "customHeaders",
    "html",
    "replyTo",
    "scheduling",
    "tagging",
    "templates",
    "tracking",
];

const isProviderFactory = (value: unknown): value is ProviderFactory => typeof value === "function";

const isProvider = (value: unknown): value is Provider =>
    value !== null && typeof value === "object" && "initialize" in value && "isAvailable" in value && "sendEmail" in value;

const resolveFeatures = (mailer: unknown): FeatureFlags | undefined => {
    if (isProvider(mailer)) {
        return mailer.features;
    }

    if (isProviderFactory(mailer)) {
        try {
            return mailer({}).features;
        } catch {
            return undefined;
        }
    }

    return undefined;
};

/**
 * Aggregates the capability flags of an aggregate provider's child mailers.
 *
 * A capability is advertised as supported (`true`) only when every resolvable child supports it,
 * and unsupported (`false`) only when every resolvable child rejects it; otherwise it is left
 * `undefined` ("unknown") so the fail-fast capability guard delegates the decision to whichever
 * mailer ultimately handles the message. This prevents a wrapper from falsely guaranteeing a
 * capability that a routed provider cannot represent (which would re-introduce silent data loss).
 * @param mailers The wrapper's configured mailers (provider instances or factories).
 * @returns The aggregated {@link FeatureFlags}; keys that cannot be determined are omitted.
 */
export default function aggregateProviderFeatures(mailers: unknown[]): FeatureFlags {
    const childFeatures = mailers.map((mailer) => resolveFeatures(mailer)).filter((features): features is FeatureFlags => features !== undefined);

    const aggregated: FeatureFlags = {};

    if (childFeatures.length === 0) {
        return aggregated;
    }

    for (const key of FEATURE_KEYS) {
        const values = childFeatures.map((features) => features[key]);

        if (values.every((value) => value === true)) {
            aggregated[key] = true;
        } else if (values.every((value) => value === false)) {
            aggregated[key] = false;
        }
    }

    return aggregated;
}
