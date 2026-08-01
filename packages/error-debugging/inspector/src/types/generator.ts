import type { InspectType, Options } from "../types";
import { safeGet } from "../utils/safe-reflect";

/**
 * Renders generator and async-generator objects. Their contents cannot be
 * inspected without consuming them, so — like `util.inspect` — we only tag the
 * type rather than draining the iterator (which would mutate the value the
 * caller asked us to render).
 */
const inspectGenerator: InspectType<Generator | AsyncGenerator> = (value: Generator | AsyncGenerator, options: Options): string => {
    // A genuine generator carries its tag on `%GeneratorPrototype%`, but there is no
    // side-effect-free way to prove that slot exists (`next`/`return` would advance the
    // iterator), so this inspector is reachable by a forged tag and the second read of
    // it may not answer the same way the dispatch read did.
    const rawTag = safeGet(value, Symbol.toStringTag);
    const tag = typeof rawTag === "string" ? rawTag : "Generator";

    return `${options.stylize(`Object [${tag}]`, "special")} {}`;
};

export default inspectGenerator;
