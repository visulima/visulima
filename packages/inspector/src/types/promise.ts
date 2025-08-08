import type { InspectType, Options } from "../types";

const inspectPromise: InspectType<Promise<unknown>> = (_value: Promise<unknown>, options: Options): string => options.stylize("Promise {…}", "special");

export default inspectPromise;
