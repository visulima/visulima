// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export const getType = (thing: any): Type =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (typeof Symbol !== "undefined" && thing[Symbol.toStringTag]) || (Object.prototype.toString.call(thing).slice(8, -1) as Type);
