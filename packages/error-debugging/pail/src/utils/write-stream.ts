const writeStream = (data: string, stream: NodeJS.WriteStream): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
    const write: NodeJS.WriteStream["write"] = ((stream as Record<string, any>).__write as NodeJS.WriteStream["write"] | undefined) ?? stream.write.bind(stream);

    return write.call(stream, data);
};

export default writeStream;
