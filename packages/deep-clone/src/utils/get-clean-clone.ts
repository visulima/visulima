/**
 * Get an empty version of the object with the same prototype it has.
 */
const getCleanClone = (prototype: any): any => {
    if (!prototype) {
        return Object.create(null);
    }

    const Constructor = prototype.constructor;

    if (Constructor === Object) {
        return prototype === Object.prototype ? {} : Object.create(prototype);
    }

    if (~Function.prototype.toString.call(Constructor).indexOf("[native code]")) {
        try {
            return new Constructor();
        } catch {}
    }

    return Object.create(prototype);
}

export default getCleanClone;
