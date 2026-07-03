export const cn = (...inputs: (string | false | null | undefined)[]): string =>
    inputs.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ");

export default cn;
