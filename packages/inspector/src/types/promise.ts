import type { Options } from "../types";

type GetPromiseValue = (value: Promise<unknown>, options: Options) => string;

const getPromiseValue: GetPromiseValue = () => "Promise{…}";

export default getPromiseValue;
