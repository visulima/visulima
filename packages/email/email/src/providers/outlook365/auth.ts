import EmailError from "../../errors/email-error";
import RequiredOptionError from "../../errors/required-option-error";
import type { Result } from "../../types";
import type { Logger } from "../../utils/create-logger";
import createTokenCache from "../../utils/create-token-cache";
import { makeRequest } from "../../utils/make-request";
import retry from "../../utils/retry";
import type { Outlook365AuthMode, Outlook365Config } from "./types";

const DEFAULT_AUTHORITY = "https://login.microsoftonline.com";
const DEFAULT_SKEW_MS = 60_000;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRIES = 3;

/**
 * Lifetime assumed when Azure AD omits `expires_in`. Deliberately short: caching a token whose
 * real lifetime is unknown risks serving a dead one, and a needless refresh is cheap.
 */
const FALLBACK_EXPIRES_IN_SECONDS = 300;

/**
 * Scope used by the app-only (client credentials) flow — permissions come from the app
 * registration's admin-consented roles, so `.default` is the only valid request.
 */
const APP_ONLY_SCOPE = "https://graph.microsoft.com/.default";

/**
 * Scopes used by the delegated (refresh token) flow. `offline_access` keeps a refresh
 * token in the response so the resolver can keep renewing without user interaction.
 */
const DELEGATED_SCOPES = ["https://graph.microsoft.com/Mail.Send", "offline_access"];

/**
 * Returns a bearer token valid for the Graph `sendMail` call.
 */
type TokenResolver = () => Promise<string>;

/**
 * A config resolved to exactly one flow, with that flow's credentials proven present. Resolving
 * once up front means the fetch path never re-narrows the loose config.
 */
type ResolvedAuth
    = | { clientId: string; clientSecret: string; mode: "clientCredentials"; tenantId: string }
        | { clientId: string; clientSecret?: string; mode: "refreshToken"; refreshToken: string; tenantId: string }
        | { getToken: TokenResolver; mode: "accessToken" }
        | { getToken: TokenResolver; mode: "getAccessToken" };

/**
 * Config fields that only mean something for a given flow. Used to warn when a flow was chosen
 * that silently ignores credentials the caller supplied.
 */
const IGNORED_FIELDS_BY_MODE: Record<Outlook365AuthMode, (keyof Outlook365Config)[]> = {
    accessToken: ["clientId", "clientSecret", "refreshToken", "tenantId"],
    clientCredentials: ["refreshToken"],
    getAccessToken: ["accessToken", "clientId", "clientSecret", "refreshToken", "tenantId"],
    refreshToken: [],
};

/**
 * A token response parsed into the fields this provider needs.
 */
interface ParsedTokenResponse {
    accessToken: string;
    expiresIn: number;
    refreshToken?: string;
}

/**
 * Strips trailing slashes without a regex — `/\/+$/` trips `sonarjs/slow-regex` even at module
 * scope, since it backtracks super-linearly.
 * @param value The string to trim.
 * @returns The value without trailing slashes.
 */
const stripTrailingSlashes = (value: string): string => {
    let endIndex = value.length;

    while (endIndex > 0 && value[endIndex - 1] === "/") {
        endIndex -= 1;
    }

    return value.slice(0, endIndex);
};

/**
 * Picks the flow implied by the supplied credentials. A caller-supplied token always wins, so an
 * explicit `accessToken` / `getAccessToken` overrides an otherwise complete built-in config.
 * @param config The provider config.
 * @param providerName Provider name used in thrown errors.
 * @returns The inferred auth mode.
 */
const inferAuthMode = (config: Outlook365Config, providerName: string): Outlook365AuthMode => {
    if (config.getAccessToken) {
        return "getAccessToken";
    }

    if (config.accessToken) {
        return "accessToken";
    }

    if (config.refreshToken) {
        return "refreshToken";
    }

    if (config.clientSecret) {
        return "clientCredentials";
    }

    throw new RequiredOptionError(providerName, ["accessToken", "getAccessToken", "clientSecret", "refreshToken"]);
};

/**
 * Resolves the config to exactly one flow and proves that flow's required options are present.
 * @param config The provider config.
 * @param providerName Provider name used in thrown errors.
 * @param logger Receives warnings about credentials the chosen flow ignores.
 * @returns The resolved auth.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const resolveAuth = (config: Outlook365Config, providerName: string, logger: Logger): ResolvedAuth => {
    const mode = config.authMode ?? inferAuthMode(config, providerName);

    const ignored = IGNORED_FIELDS_BY_MODE[mode].filter((field) => config[field] !== undefined);

    if (ignored.length > 0) {
        logger.warn(`The '${mode}' auth mode ignores these configured options: ${ignored.join(", ")}. Set 'authMode' to pin the intended flow.`);
    }

    if (mode === "getAccessToken") {
        const { getAccessToken } = config;

        if (!getAccessToken) {
            throw new RequiredOptionError(providerName, "getAccessToken");
        }

        return { getToken: async () => getAccessToken(), mode };
    }

    if (mode === "accessToken") {
        const { accessToken } = config;

        if (!accessToken) {
            throw new RequiredOptionError(providerName, "accessToken");
        }

        return { getToken: () => Promise.resolve(accessToken), mode };
    }

    const { clientId, clientSecret, refreshToken, tenantId } = config;

    const missing: string[] = [];

    if (!tenantId) {
        missing.push("tenantId");
    }

    if (!clientId) {
        missing.push("clientId");
    }

    if (mode === "clientCredentials" && !clientSecret) {
        missing.push("clientSecret");
    }

    if (mode === "refreshToken" && !refreshToken) {
        missing.push("refreshToken");
    }

    // Each throw below reports the full `missing` list, so one error names every absent option.
    if (!tenantId || !clientId) {
        throw new RequiredOptionError(providerName, missing);
    }

    if (mode === "clientCredentials") {
        if (!clientSecret) {
            throw new RequiredOptionError(providerName, missing);
        }

        return { clientId, clientSecret, mode, tenantId };
    }

    if (!refreshToken) {
        throw new RequiredOptionError(providerName, missing);
    }

    return { clientId, clientSecret, mode, refreshToken, tenantId };
};

/**
 * Reads the token endpoint payload, converting an OAuth2 error response into an {@link EmailError}.
 * @param body The parsed response body.
 * @param providerName Provider name used in thrown errors.
 * @param statusCode The HTTP status code of the token response.
 * @returns The access token, its lifetime in seconds, and a rotated refresh token when present.
 */
const readTokenResponse = (body: unknown, providerName: string, statusCode: number): ParsedTokenResponse => {
    if (typeof body !== "object" || body === null) {
        throw new EmailError(providerName, `Token endpoint returned a non-JSON response (status ${String(statusCode)})`);
    }

    const payload = body as Record<string, unknown>;

    if (typeof payload.error === "string") {
        const description = typeof payload.error_description === "string" ? payload.error_description : "no description provided";

        throw new EmailError(providerName, `Token request failed: ${payload.error} — ${description}`, {
            code: payload.error,
            hint: "Check the tenantId, clientId and client secret / refresh token in the Azure app registration.",
        });
    }

    if (typeof payload.access_token !== "string") {
        throw new EmailError(providerName, `Token endpoint response did not contain an access_token (status ${String(statusCode)})`);
    }

    return {
        accessToken: payload.access_token,
        expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : FALLBACK_EXPIRES_IN_SECONDS,
        refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
    };
};

/**
 * Azure AD throttles the token endpoint (429) and can return 5xx; a status of 0 means the
 * request never landed. Credential errors (400/401) will never succeed on a retry.
 * @param statusCode The HTTP status code.
 * @returns Whether the request is worth retrying.
 */
const isRetryableStatus = (statusCode: number): boolean => statusCode === 0 || statusCode === 408 || statusCode === 429 || statusCode >= 500;

/**
 * Builds a token resolver for the resolved auth, caching the token until shortly before it
 * expires and collapsing concurrent refreshes into a single request.
 * @param auth The resolved auth.
 * @param config The provider config, for transport and cache tuning.
 * @param providerName Provider name used in thrown errors.
 * @param logger Receives refresh-token persistence failures.
 * @returns A function returning a valid bearer token.
 */
const createTokenResolver = (auth: ResolvedAuth, config: Outlook365Config, providerName: string, logger: Logger): TokenResolver => {
    if (auth.mode === "accessToken" || auth.mode === "getAccessToken") {
        return auth.getToken;
    }

    const authority = stripTrailingSlashes(config.authority ?? DEFAULT_AUTHORITY);
    const tokenUrl = `${authority}/${auth.tenantId}/oauth2/v2.0/token`;
    const timeout = config.timeout ?? DEFAULT_TIMEOUT;
    const retries = config.retries ?? DEFAULT_RETRIES;
    const now = config.now ?? Date.now;

    // Azure AD may rotate the refresh token on every use, so track the latest one rather than
    // replaying the original — a stale token gets rejected once rotation is enabled.
    let refreshToken = auth.mode === "refreshToken" ? auth.refreshToken : undefined;

    const buildBody = (): string => {
        const body = new URLSearchParams({
            client_id: auth.clientId,
            scope: (config.scopes ?? (auth.mode === "clientCredentials" ? [APP_ONLY_SCOPE] : DELEGATED_SCOPES)).join(" "),
        });

        if (auth.clientSecret) {
            body.set("client_secret", auth.clientSecret);
        }

        if (auth.mode === "clientCredentials") {
            body.set("grant_type", "client_credentials");
        } else {
            body.set("grant_type", "refresh_token");
            body.set("refresh_token", refreshToken as string);
        }

        return body.toString();
    };

    const readStatus = (result: Result): number => (result.data as { statusCode?: number } | undefined)?.statusCode ?? 0;

    /**
     * `retry` retries whenever the result is unsuccessful, so only transient failures are
     * reported as such — a bad secret is returned as "successful transport" for the caller to
     * parse, rather than being retried three times with backoff.
     */
    const requestToken = async (): Promise<Result> => {
        const result = await makeRequest(tokenUrl, { headers: { "Content-Type": "application/x-www-form-urlencoded" }, method: "POST", timeout }, buildBody());

        if (!result.success && isRetryableStatus(readStatus(result))) {
            return result;
        }

        return { data: result.data, success: true };
    };

    const persistRotatedToken = async (rotated: string): Promise<void> => {
        // Adopt before persisting: Azure AD has already invalidated the previous token, so the
        // rotated one is the only usable value whether or not the caller can store it.
        refreshToken = rotated;

        if (!config.onRefreshToken) {
            return;
        }

        try {
            await config.onRefreshToken(rotated);
        } catch (error) {
            // The access token in hand is still valid, so failing the send here would be
            // spurious — but the stored token is now stale and will break on restart.
            logger.error(
                `Failed to persist the rotated refresh token — the stored token is stale and sending will fail after a restart: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    };

    const fetchToken = async (): Promise<{ accessToken: string; expiresAt: number }> => {
        const result = await retry(requestToken, retries);
        const responseBody = (result.data as { body?: unknown } | undefined)?.body;

        // A non-2xx token response still carries an OAuth2 error payload, which is far more useful
        // than the generic transport error, so parse the body before falling back to result.error.
        if (!result.success && (typeof responseBody !== "object" || responseBody === null)) {
            throw result.error instanceof Error ? result.error : new EmailError(providerName, "Token request failed");
        }

        const parsed = readTokenResponse(responseBody, providerName, readStatus(result));

        if (parsed.refreshToken && parsed.refreshToken !== refreshToken) {
            await persistRotatedToken(parsed.refreshToken);
        }

        return { accessToken: parsed.accessToken, expiresAt: now() + parsed.expiresIn * 1000 };
    };

    const getToken = createTokenCache(fetchToken, { now, skewMs: config.tokenRefreshSkewMs ?? DEFAULT_SKEW_MS });

    return async (): Promise<string> => {
        const token = await getToken();

        return token.accessToken;
    };
};

export { createTokenResolver, resolveAuth };
