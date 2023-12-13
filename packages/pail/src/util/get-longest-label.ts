import { DefaultLoggerTypes, LoggerConfiguration } from "../types";

const getLongestLabel = <L extends string, T extends string>(types: DefaultLoggerTypes<L> & Record<T, Partial<LoggerConfiguration<L>>>): string => {
    const labels = Object.keys(types).map((x) => types[x as T].label ?? "");

    return labels.reduce((x, y) => (x.length > y.length ? x : y));
};

export default getLongestLabel;
