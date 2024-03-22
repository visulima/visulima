import { cyan } from "@visulima/colorize";

import type { BuildContext } from "../types";
import { arrayIncludes } from "../utils/array-includes";
import { getPackageName } from "../utils/get-package-name";
import warn from "../utils/warn";

const validateDependencies = (context: BuildContext) => {
    const usedDependencies = new Set<string>();
    const unusedDependencies = new Set<string>(Object.keys(context.pkg.dependencies || {}));
    const implicitDependencies = new Set<string>();

    for (const id of context.usedImports) {
        unusedDependencies.delete(id);
        usedDependencies.add(id);
    }

    if (Array.isArray(context.options.dependencies)) {
        for (const id of context.options.dependencies) {
            unusedDependencies.delete(id);
        }
    }

    for (const id of usedDependencies) {
        if (
            !arrayIncludes(context.options.externals, id) &&
            !id.startsWith("chunks/") &&
            !context.options.dependencies.includes(getPackageName(id)) &&
            !context.options.peerDependencies.includes(getPackageName(id))
        ) {
            implicitDependencies.add(id);
        }
    }
    if (unusedDependencies.size > 0) {
        warn(context, `Potential unused dependencies found: ${[...unusedDependencies].map((id) => cyan(id)).join(", ")}`);
    }
    if (implicitDependencies.size > 0 && !context.options.rollup.inlineDependencies) {
        warn(context, `Potential implicit dependencies found: ${[...implicitDependencies].map((id) => cyan(id)).join(", ")}`);
    }
}

export default validateDependencies;
