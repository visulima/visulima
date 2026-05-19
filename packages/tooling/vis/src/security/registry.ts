/**
 * Security provider registry.
 *
 * Resolves the `security` config into a list of enabled `SecurityProvider`
 * instances and exposes a helper to run them all in parallel + merge results.
 *
 * Provider order matters: the first provider in the returned list is the
 * **primary** — its `score` wins in merge conflicts. Order is determined by
 * `security.primaryProvider` (when both providers are enabled).
 */

import type { VisConfig } from "../config/workspace";
import { createDepsDevProvider } from "./deps-dev-security";
import type { PackageRef, PackageReportData, SecurityProvider } from "./provider";
import { mergeReports } from "./provider";
import { createSnykProvider } from "./snyk-security";
import { createSocketProvider } from "./socket-security";

/** Options for `buildEnabledProviders`. */
export interface BuildEnabledProvidersOptions {
    /**
     * Provider ids that should be skipped regardless of config. Used to honour
     * offline mode and `MARSHALL_DISABLE_*` env-var escape hatches.
     */
    disabled?: ReadonlySet<string>;

    /** Score threshold to thread through to every provider that supports one. */
    minimumScore?: number;
}

/**
 * Resolves the security config into a list of enabled provider instances.
 * Providers without credentials or with `enabled: false` are filtered out.
 * The primary provider (per `security.primaryProvider`, defaulting to
 * `"socket"`) is returned first so it wins merge conflicts.
 */
export const buildEnabledProviders = (security: VisConfig["security"] | undefined, opts: BuildEnabledProvidersOptions = {}): SecurityProvider[] => {
    const { disabled, minimumScore } = opts;
    const providers: SecurityProvider[] = [];

    if (!disabled?.has("socket")) {
        const socket = createSocketProvider(security?.socket, { minimumScore });

        if (socket) {
            providers.push(socket);
        }
    }

    if (!disabled?.has("deps-dev")) {
        const depsDev = createDepsDevProvider(security?.depsDev);

        if (depsDev) {
            providers.push(depsDev);
        }
    }

    if (!disabled?.has("snyk")) {
        const snyk = createSnykProvider(security?.snyk);

        if (snyk) {
            providers.push(snyk);
        }
    }

    const primary = security?.primaryProvider;

    if (primary && providers.length > 1) {
        providers.sort((a, b) => {
            if (a.id === primary) {
                return -1;
            }

            if (b.id === primary) {
                return 1;
            }

            return 0;
        });
    }

    return providers;
};

/**
 * Run every provider against the given packages in parallel and merge the
 * results. Provider failures are isolated — a rejected provider does not
 * abort the others, it just contributes an empty map.
 */
export const fetchAllReports = async (providers: ReadonlyArray<SecurityProvider>, packages: PackageRef[]): Promise<Map<string, PackageReportData>> => {
    if (providers.length === 0 || packages.length === 0) {
        return new Map();
    }

    const settled = await Promise.allSettled(providers.map((provider) => provider.fetchReports(packages)));

    const maps = settled.map((result) => (result.status === "fulfilled" ? result.value : new Map<string, PackageReportData>()));

    return mergeReports(maps);
};
