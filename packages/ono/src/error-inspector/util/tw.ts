import { twMerge } from "tailwind-merge";

export const cn = (...inputs: (string | false | null | undefined)[]): string => twMerge(inputs.filter((v): v is string => typeof v === "string" && v.length > 0).join(" "));

export default cn;
