import type { PossibleOptionDefinition } from "../../@types/command";

const isBoolean = <T>(option: PossibleOptionDefinition<T>): boolean => option.type?.name === "Boolean";

export default isBoolean;
