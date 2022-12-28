import File from "./file";

const updateSize = (file: File, size: number): File => {
    if (size < (file.size as number)) {
        // eslint-disable-next-line no-param-reassign
        file.size = size;
    }

    return file;
};

export default updateSize;
