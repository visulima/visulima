import type { EmailOptions, FeatureFlags } from "../../types";
import headersToRecord from "../headers-to-record";

/**
 * Describes how to detect whether a message actually uses a given capability.
 */
interface CapabilityProbe {
    /**
     * Returns the message field that triggers this capability, or undefined when the
     * message does not exercise it. The returned name is the field the user actually set
     * (e.g. `sendAt` vs `scheduledAt`) so the resulting violation is accurate.
     * @param options The email options to inspect.
     */
    detect: (options: EmailOptions) => string | undefined;
    feature: keyof FeatureFlags;
    label: string;
}

const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const firstSetField = (options: EmailOptions, fields: string[]): string | undefined =>
    fields.find((field) => (options as EmailOptions & Record<string, unknown>)[field] !== undefined);

/**
 * Message-level capability probes.
 *
 * Only capabilities that can be reliably detected from the normalized message
 * are listed here. Provider-specific extension fields (`scheduledAt`,
 * `templateId`, ...) are detected defensively when present on the options object.
 */
/* eslint-disable @stylistic/no-extra-parens -- prettier wraps these conditional arrow bodies in parens (also required by no-confusing-arrow). */
const CAPABILITY_PROBES: CapabilityProbe[] = [
    {
        detect: (options) => (hasItems(options.attachments) ? "attachments" : undefined),
        feature: "attachments",
        label: "attachments",
    },
    {
        detect: (options) => (typeof options.html === "string" && options.html.length > 0 ? "html" : undefined),
        feature: "html",
        label: "HTML content",
    },
    {
        detect: (options) => (options.replyTo ? "replyTo" : undefined),
        feature: "replyTo",
        label: "a reply-to address",
    },
    {
        detect: (options) => (options.headers !== undefined && Object.keys(headersToRecord(options.headers)).length > 0 ? "headers" : undefined),
        feature: "customHeaders",
        label: "custom headers",
    },
    {
        detect: (options) => (hasItems(options.tags) ? "tags" : undefined),
        feature: "tagging",
        label: "tags",
    },
    {
        detect: (options) => firstSetField(options, ["scheduledAt", "sendAt"]),
        feature: "scheduling",
        label: "scheduled delivery",
    },
    {
        detect: (options) => firstSetField(options, ["templateId", "template"]),
        feature: "templates",
        label: "provider templates",
    },
];
/* eslint-enable @stylistic/no-extra-parens */

/**
 * A single capability that a message uses but the target provider cannot represent.
 */
export interface FeatureViolation {
    /**
     * The provider capability flag that is not supported.
     */
    feature: keyof FeatureFlags;

    /**
     * The message field that triggered the check.
     */
    field: string;

    /**
     * Human-readable explanation of the violation.
     */
    message: string;
}

/**
 * Result of a fail-fast provider capability check.
 */
export interface FeatureSupportResult {
    /**
     * True when the message uses no capability the provider has explicitly disabled.
     */
    supported: boolean;

    /**
     * The list of capabilities the message uses that the provider cannot represent.
     */
    violations: FeatureViolation[];
}

/**
 * Performs a fail-fast field-support check for a message against a provider's declared capabilities.
 *
 * A capability counts as a violation only when the message actually uses it **and** the provider
 * has explicitly declared it unsupported (`features[capability] === false`). Capabilities left
 * `undefined` are treated as "unknown" and never raise a violation, so providers that publish a
 * partial (or no) {@link FeatureFlags} map are never falsely rejected.
 * @param options The normalized email options about to be sent.
 * @param features The target provider's declared capabilities. When omitted the check is a no-op.
 * @returns A {@link FeatureSupportResult} describing any unsupported capabilities in use.
 * @example
 * ```ts
 * const { supported, violations } = checkFeatureSupport(message, provider.features);
 *
 * if (!supported) {
 *     throw new Error(violations.map((v) => v.message).join(", "));
 * }
 * ```
 */
export default function checkFeatureSupport(options: EmailOptions, features?: FeatureFlags): FeatureSupportResult {
    if (!features) {
        return { supported: true, violations: [] };
    }

    const violations: FeatureViolation[] = [];

    for (const probe of CAPABILITY_PROBES) {
        if (features[probe.feature] !== false) {
            continue;
        }

        const field = probe.detect(options);

        if (field !== undefined) {
            violations.push({
                feature: probe.feature,
                field,
                message: `Message uses ${probe.label} (field "${field}") but the provider does not support the "${probe.feature}" capability`,
            });
        }
    }

    return { supported: violations.length === 0, violations };
}
