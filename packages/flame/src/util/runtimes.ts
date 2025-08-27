// https://runtime-keys.proposal.wintercg.org/
export type RuntimeName = "bun" | "deno" | "edge-light" | "fastly" | "lagon" | "netlify" | "node" | "workerd";

type GlobalHints = {
    Netlify?: unknown;
    EdgeRuntime?: unknown;
    navigator?: { userAgent?: string };
    Deno?: unknown;
    __lagon__?: unknown;
    process?: { release?: { name?: string }; versions?: { bun?: string } };
    Bun?: unknown;
    fastly?: unknown;
};

const g = globalThis as unknown as GlobalHints;

const runtimeChecks: [boolean, RuntimeName][] = [
    [!!g.Netlify, "netlify"],
    [!!g.EdgeRuntime, "edge-light"],
    // https://developers.cloudflare.com/workers/runtime-apis/web-standards/#navigatoruseragent
    [g.navigator?.userAgent === "Cloudflare-Workers", "workerd"],
    [!!g.Deno, "deno"],
    // https://nodejs.org/api/process.html#processrelease
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

export default runtime;
