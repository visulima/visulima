// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export const getType = (thing: any): string => Object.prototype.toString.call(thing).slice(8, -1);
