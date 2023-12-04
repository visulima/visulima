// https://runtime-keys.proposal.wintercg.org/
export type RuntimeName = "bun" | "deno" | "edge-light" | "fastly" | "lagon" | "netlify" | "node" | "workerd";

const runtimeChecks: [boolean, RuntimeName][] = [
    [!!globalThis.Netlify, "netlify"],
    [!!globalThis.EdgeRuntime, "edge-light"],
    // https://developers.cloudflare.com/workers/runtime-apis/web-standards/#navigatoruseragent
    [globalThis.navigator?.userAgent === "Cloudflare-Workers", "workerd"],
    [!!globalThis.Deno, "deno"],
    // https://nodejs.org/api/process.html#processrelease
    [!!globalThis.__lagon__, "lagon"],
    [globalThis.process.release.name === "node", "node"],
    [!!globalThis.Bun || !!globalThis.process.versions.bun, "bun"],
    [!!globalThis.fastly, "fastly"],
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
