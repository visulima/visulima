import type { InspectType } from "../types";

const getPromiseValue: InspectType<Promise<unknown>> = () => "Promise{…}";

export default getPromiseValue;
