import merge from "./object-deep-merge";

const objectPathResolver = (
    mod: Record<string, unknown> | Array<Record<string, unknown>>,
    path: Record<string, unknown> = {},
    location: Array<string> = [],
    valued: Record<string, unknown> = {},
): undefined | Record<string, unknown> => {
    if (Array.isArray(mod)) {
        const length = mod.length;
        const res = [];

        let index = 0;

        while (index < length) {
            res.push(objectPathResolver(mod[index], path, location, valued));
            index++;
        }

        let base;

        if (res.length > 0) {
            base = res[0] as Record<string, unknown>;

            let resindex = 1;

            const reslength = res.length;

            while (resindex < reslength) {
                if (res[resindex]) {
                    base = merge(base, res[resindex] as Record<string, unknown>);
                }

                resindex++;
            }
        }

        return base;
    } else if (mod) {
        const keys = Object.keys(mod);
        const keyslength = keys.length;

        let keysindex;

        for (keysindex = 0; keysindex < keyslength; keysindex++) {
            const key = keys[keysindex];
            const value = mod[key];

            if (value && typeof value === "object" && value.constructor === Object) {
                const tmp = location.slice();

                const direct = (value as Record<string, unknown>).direct === true;
                const set = "value" in value;
                const rule = "rule" in value;

                let pathcursor = path;

                const passedpath: Record<string, unknown> = {};

                let cursor = passedpath;

                if (direct || !(set && rule)) {
                    let tmpindex = 0;

                    const tmplength = tmp.length;

                    while (tmpindex < tmplength) {
                        const step = tmp[tmpindex];

                        pathcursor = pathcursor[step] as Record<string, unknown>;
                        cursor[step] = {};
                        cursor = cursor[step] as Record<string, unknown>;
                        tmpindex++;
                    }

                    tmp.push(key);
                    cursor[key] = {};

                    let sub;

                    if (!direct && rule) {
                        sub = objectPathResolver((value as Record<string, unknown>)["rule"] as Record<string, unknown> | Array<Record<string, unknown>>, passedpath, tmp);
                    } else {
                        sub = objectPathResolver(value as Record<string, unknown>, passedpath, tmp);
                    }

                    if (sub) {
                        valued = merge(valued, sub);
                    }
                }

                if (!direct && set) {
                    valued = merge(valued, path);
                }
            }
        }
        return valued;
    }
}

export default objectPathResolver;
