// Keys that must never be used as merge targets — assigning to them can corrupt
// the prototype chain of the built spec object. The `yaml` package surfaces
// `__proto__` as an own key (via `Object.defineProperty`), so these can reach
// us from developer-authored YAML/JSDoc.
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const objectMerge = <T>(a: T, b: T): void => {
    Object.keys(b as object).forEach((key) => {
        if (FORBIDDEN_KEYS.has(key)) {
            return;
        }

        if (a[key as keyof typeof b] === undefined) {
            // eslint-disable-next-line no-param-reassign
            a[key as keyof typeof b] = {
                ...b[key as keyof typeof b],
            };
        } else {
            Object.keys(b[key as keyof typeof b] as object).forEach((subKey) => {
                if (FORBIDDEN_KEYS.has(subKey)) {
                    return;
                }

                // eslint-disable-next-line no-param-reassign
                (a[key as keyof typeof b] as Record<string, object>)[subKey] = {
                    ...(a[key as keyof typeof b] as Record<string, object>)[subKey],
                    ...(b[key as keyof typeof b] as Record<string, object>)[subKey],
                };
            });
        }
    });
};

export default objectMerge;
