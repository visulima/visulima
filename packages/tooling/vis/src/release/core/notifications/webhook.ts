/**
 * Generic webhook notification channel.
 *
 * For destinations that aren't Slack or Discord — Microsoft Teams,
 * Mattermost, internal dashboards, alertmanager, etc. The operator
 * controls the HTTP request shape entirely:
 *
 *   release: {
 *       notifications: {
 *           webhook: {
 *               url: "https://hooks.example.com/release",
 *               method: "POST",
 *               headers: { "X-Auth": "${WEBHOOK_TOKEN}" },
 *               body: {                                // JSON template
 *                   text: "Released {count} packages",
 *                   packages: "{packages}",
 *               },
 *           },
 *       },
 *   }
 *
 * The body template is recursively interpolated — strings flow
 * through `expandNotificationTemplate`; arrays / nested objects
 * preserve structure. When `body` is omitted, vis sends a
 * SAFE-by-default subset of the NotificationContext: semver-shaped
 * `published[]` entries plus skipped[].name only. The freeform-text
 * `skipped[].reason` strings are intentionally dropped (M-10), since
 * they can embed shell-runner stderr fragments that may carry secrets
 * which escaped the upstream redactor. Operators who want
 * `skipped[].reason` in the dispatched body must opt in by providing
 * an explicit `body` template — at which point they're consciously
 * choosing to forward that text to the receiver.
 */

import type { WebhookConfig } from "../../types";
import { redactTokens } from "../security";
import type { NotificationChannel, NotificationContext } from "./interface";
import { expandNotificationTemplate } from "./interface";

/**
 * Walk an arbitrary JSON-ish value, expanding `{token}` placeholders
 * in every string leaf. Preserves arrays, objects, numbers, and
 * booleans untouched.
 */
const interpolateDeep = (value: unknown, context: NotificationContext): unknown => {
    if (typeof value === "string") {
        return expandNotificationTemplate(value, context);
    }

    if (Array.isArray(value)) {
        return value.map((entry) => interpolateDeep(entry, context));
    }

    if (value !== null && typeof value === "object") {
        const next: Record<string, unknown> = {};

        for (const [key, sub] of Object.entries(value)) {
            next[key] = interpolateDeep(sub, context);
        }

        return next;
    }

    return value;
};

/**
 * Build the default request body when the operator did NOT supply an
 * explicit `body` template. Drops freeform-text fields whose contents
 * we can't bound — primarily `skipped[].reason`, which is populated
 * from shell-runner stderr fragments and can carry pre-redaction
 * secrets. The remaining fields are either well-shaped (semver,
 * timestamps, slugs) or operator-set and not derived from process
 * output, so they are safe to forward verbatim.
 *
 * Operators who DO need the reason strings in their webhook payload
 * can opt in with `body: { reasons: "{packages}", … }` or a fuller
 * template — at which point they're consciously choosing to forward
 * that text. See M-10 in audit notes.
 */
const buildDefaultSafeBody = (context: NotificationContext): Record<string, unknown> => {
    return {
        channel: context.channel,
        completedAt: context.completedAt,
        monorepoName: context.monorepoName,
        // Semver-shaped values, no free text — safe to forward.
        published: context.published.map((pkg) => {
            return {
                name: pkg.name,
                tag: pkg.tag,
                url: pkg.url,
                version: pkg.version,
            };
        }),
        repo: context.repo,
        // M-10: drop `reason`; it carries shell stderr fragments that
        // may embed secrets the redactor missed.
        skipped: context.skipped.map((entry) => {
            return { name: entry.name };
        }),
    };
};

const interpolateHeaders = (headers: Record<string, string> | undefined, context: NotificationContext): Record<string, string> => {
    if (!headers) {
        return {};
    }

    const next: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
        next[key] = expandNotificationTemplate(value, context);
    }

    return next;
};

export class WebhookNotificationChannel implements NotificationChannel {
    public readonly id: string;

    public constructor(private readonly config: WebhookConfig) {
        this.id = config.id ? `webhook:${config.id}` : "webhook";
    }

    public async send(context: NotificationContext): Promise<void> {
        const method = this.config.method ?? "POST";
        const headers = {
            "Content-Type": "application/json",
            ...interpolateHeaders(this.config.headers, context),
        };

        // Body resolution: explicit body template wins; absent body
        // sends a SAFE-by-default subset of the NotificationContext.
        // The safe subset drops freeform-text fields (notably
        // `skipped[].reason`, which is populated from shell-runner
        // stderr and can carry pre-redaction secrets). Operators who
        // want the full context must opt in with an explicit template.
        const body = this.config.body === undefined ? buildDefaultSafeBody(context) : interpolateDeep(this.config.body, context);

        let response: Response;

        try {
            response = await fetch(this.config.url, {
                body: JSON.stringify(body),
                headers,
                method,
            });
        } catch (error) {
            // Wrap the underlying network/DNS error so the URL (which may
            // itself be a secret — Slack/Discord-style bearer paths, or a
            // URL containing `?token=...`) never surfaces in logs or in
            // `result.failed[].error`.
            const reason = error instanceof Error ? error.name : "NetworkError";

            throw new Error(`Webhook ${this.id} fetch failed (${reason})`, { cause: error });
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");

            // Intentionally redact the URL with a placeholder — the path
            // may contain a bearer secret (Slack/Discord-style webhooks). The
            // response body is server-controlled and may echo a forwarded
            // auth header, so it's run through redactTokens before surfacing.
            const safeBody = errorBody ? `: ${redactTokens(errorBody.slice(0, 200))}` : "";

            throw new Error(`Webhook ${this.id} POST <webhook-url> returned ${response.status} ${response.statusText}${safeBody}`);
        }
    }
}
