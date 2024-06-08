import type { Options } from "../types";

type GetPromiseValue = (value: Promise<unknown>, options: Options) => string;

let getPromiseValue: GetPromiseValue = () => "Promise{…}";

try {
    // @ts-expect-error
    const { getPromiseDetails, kPending, kRejected } = process.binding("util");

    if (Array.isArray(getPromiseDetails(Promise.resolve()))) {
        getPromiseValue = (value, options: Options) => {
            const [state, innerValue] = getPromiseDetails(value);

            if (state === kPending) {
                return "Promise{<pending>}";
            }

            return `Promise${state === kRejected ? "!" : ""}{${options.inspect(innerValue, options)}}`;
        };
    }
} catch {
    /* ignore */
}

export default getPromiseValue;
