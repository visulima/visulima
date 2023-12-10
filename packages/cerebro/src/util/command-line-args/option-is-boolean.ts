import type { OptionDefinition } from "../../@types/command";

const isBoolean = <T>(option: OptionDefinition<T>): boolean => option.type?.name === "Boolean";

export default isBoolean;
