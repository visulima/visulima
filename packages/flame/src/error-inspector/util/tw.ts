import { twMerge } from "tailwind-merge";

export const cn = (...inputs: Array<string | false | null | undefined>): string => {
    return twMerge(inputs.filter((v): v is string => typeof v === "string" && v.length > 0).join(" "));
};

export default cn;
