import type File from "./file";

const isExpired = (file: File): boolean => {
    if (!file.expiredAt) {
        return false;
    }

    return Date.now() > +new Date(file.expiredAt);
};

export default isExpired;
