/**
 * Unflag layer — Node-version-keyed experimental flags for `vis x`. Some runtime
 * features are gated behind experimental flags on the supported Node floor (e.g.
 * `node:sqlite`, web storage, EventSource); `vis x` can flip them on for the user's
 * script. Strictly opt-in via `VIS_UNFLAG`, and version-gated so we never pass a
 * flag the running Node would reject.
 *
 * Because V8/experimental flags can only be set at process start, the `vis x`
 * runner RE-EXECS Node with these flags (see `commands/x/run-file.ts`), the same
 * way `@visulima/cerebro`'s heap tuning re-execs — there is no native launcher.
 *
 * `VIS_UNFLAG` values: `all`/`1`/`true`/empty enables every rule whose version
 * window includes the running Node; a comma list (`sqlite,webstorage`) selects a
 * subset by key.
 */

interface UnflagRule {
    /** The flag to inject. */
    flag: string;
    /** Selector key for the comma-list spec. */
    key: string;

    /**
     * Inclusive upper bound: the last [major, minor] at which the flag is still
     * needed. Omit for flags that remain experimental on every newer Node. Used for
     * features that flip on by default at some version, after which passing the
     * `--experimental-*` flag is at best a no-op and at worst rejected.
     */
    max?: [number, number];
    /** Minimum Node version at which the flag exists, as [major, minor]. */
    min: [number, number];
}

const RULES: UnflagRule[] = [
    // Better stack traces for the user script. Stable since Node 12.
    { flag: "--enable-source-maps", key: "sourcemaps", min: [22, 0] },
    // node:sqlite — experimental flag introduced in Node 22.5.
    { flag: "--experimental-sqlite", key: "sqlite", min: [22, 5] },
    // Web Storage (sessionStorage; localStorage also needs --localstorage-file,
    // added by the `localstorage` key below). Experimental flag since 22.4.
    { flag: "--experimental-webstorage", key: "webstorage", min: [22, 4] },
    // EventSource (server-sent events) client — experimental flag since 22.3.
    { flag: "--experimental-eventsource", key: "eventsource", min: [22, 3] },
    // Global WebSocket client — flag introduced in 20.10, on by default since 22.0.
    // Only inject on the 20.10–21.x band; 22+ has it unconditionally and the flag is
    // gone, so passing it there would error.
    { flag: "--experimental-websocket", key: "websocket", max: [21, 999], min: [20, 10] },
    // vm.Module / vm.SourceTextModule (ESM in the vm module) — experimental flag,
    // still required on every supported Node (never default-on), so no upper bound.
    { flag: "--experimental-vm-modules", key: "vm-modules", min: [22, 0] },
];

const LOCALSTORAGE_MIN: [number, number] = [22, 4];

/** Parse `process.versions.node` ("24.15.0") into [major, minor]. */
const parseNodeVersion = (version: string): [number, number] => {
    const [major, minor] = version.split(".").map((part) => Number.parseInt(part, 10));

    return [major ?? 0, minor ?? 0];
};

const satisfies = (version: [number, number], min: [number, number]): boolean => version[0] > min[0] || (version[0] === min[0] && version[1] >= min[1]);

/** `version &lt;= max` (inclusive), with the same [major, minor] ordering as `satisfies`. */
const atMost = (version: [number, number], max: [number, number]): boolean => version[0] < max[0] || (version[0] === max[0] && version[1] <= max[1]);

/** A rule applies when the running Node is at or above `min` and at or below `max` (if set). */
const inBand = (version: [number, number], rule: UnflagRule): boolean => satisfies(version, rule.min) && (rule.max === undefined || atMost(version, rule.max));

const wantsAll = (spec: string): boolean => {
    const trimmed = spec.trim().toLowerCase();

    return trimmed === "" || trimmed === "all" || trimmed === "1" || trimmed === "true";
};

const selects = (spec: string, key: string): boolean => wantsAll(spec) || spec.split(",").some((part) => part.trim().toLowerCase() === key);

/**
 * The Node flags to inject for a `VIS_UNFLAG` spec on the given Node version.
 * `localstorageFile` is used for `--localstorage-file` when the `localstorage` key
 * is selected (persistent `localStorage` needs a backing file).
 */
export const unflagArgs = (spec: string, nodeVersion: string, localstorageFile: string): string[] => {
    const version = parseNodeVersion(nodeVersion);
    const flags: string[] = [];

    for (const rule of RULES) {
        if (selects(spec, rule.key) && inBand(version, rule)) {
            flags.push(rule.flag);
        }
    }

    if (selects(spec, "localstorage") && satisfies(version, LOCALSTORAGE_MIN)) {
        if (!flags.includes("--experimental-webstorage")) {
            flags.push("--experimental-webstorage");
        }

        flags.push(`--localstorage-file=${localstorageFile}`);
    }

    return flags;
};
