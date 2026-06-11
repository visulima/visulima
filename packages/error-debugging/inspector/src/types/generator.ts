import type { InspectType, Options } from "../types";

/**
 * Renders generator and async-generator objects. Their contents cannot be
 * inspected without consuming them, so — like `util.inspect` — we only tag the
 * type rather than draining the iterator (which would mutate the value the
 * caller asked us to render).
 */
const inspectGenerator: InspectType<Generator | AsyncGenerator> = (value: Generator | AsyncGenerator, options: Options): string => {
    const tag = (value as { [Symbol.toStringTag]?: string })[Symbol.toStringTag] ?? "Generator";

    return `${options.stylize(`Object [${tag}]`, "special")} {}`;
};

export default inspectGenerator;
