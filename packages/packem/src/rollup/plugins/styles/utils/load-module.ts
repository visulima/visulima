import { createRequire } from "node:module";

import type { ResolveOpts as ResolveOptions } from "./resolve";
import { resolveSync } from "./resolve";

const require = createRequire(import.meta.url);

const loaded: Record<string, unknown> = {};

const options: ResolveOptions = {
    basedirs: [process.cwd()],
    caller: "Module loader",
    extensions: [".js", ".mjs", ".cjs", ".json"],
    packageFilter: (package_) => package_,
    preserveSymlinks: false,
};

export default function (moduleId: string): unknown {
    if (loaded[moduleId]) {
        return loaded[moduleId];
    }

    if (loaded[moduleId] === null) {
        return;
    }

    try {
        loaded[moduleId] = require(resolveSync([moduleId, `./${moduleId}`], options));
    } catch {
        loaded[moduleId] = null;
        return;
    }

    return loaded[moduleId];
}
