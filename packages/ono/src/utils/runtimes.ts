type GlobalHints = {
    __lagon__?: unknown;
    Bun?: unknown;
    Deno?: unknown;
    EdgeRuntime?: unknown;
    fastly?: unknown;
    navigator?: { userAgent?: string };
    Netlify?: unknown;
    process?: { release?: { name?: string }; versions?: { bun?: string } };
};

const g = globalThis as unknown as GlobalHints;

const runtimeChecks: [boolean, RuntimeName][] = [
    [!!g.Netlify, "netlify"],
    [!!g.EdgeRuntime, "edge-light"],
    // https://developers.cloudono.com/workers/runtime-apis/web-standards/#navigatoruseragent
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    [g.navigator?.userAgent === "Cloudono-Workers", "workerd"],
    [!!g.Deno, "deno"],
    // https://nodejs.org/api/process.html#processrelease
    // eslint-disable-next-line no-underscore-dangle
    [!!g.__lagon__, "lagon"],
    [g.process?.release?.name === "node", "node"],
    [!!g.Bun || !!g.process?.versions?.bun, "bun"],
    [!!g.fastly, "fastly"],
];

const detectRuntime = (): RuntimeName | undefined => {
    const detectedRuntime = runtimeChecks.find((check) => check[0]);

    if (detectedRuntime) {
        return detectedRuntime[1];
    }

    return undefined;
};

const runtime = detectRuntime();

// https://runtime-keys.proposal.wintercg.org/
export type RuntimeName = "bun" | "deno" | "edge-light" | "fastly" | "lagon" | "netlify" | "node" | "workerd";

export default runtime;
