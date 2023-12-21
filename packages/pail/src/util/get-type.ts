const getType = (thing: object): string => Object.prototype.toString.call(thing).slice(8, -1);

export default getType;
