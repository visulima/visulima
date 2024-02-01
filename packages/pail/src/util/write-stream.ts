export const writeStream = (data: string, stream: NodeJS.WriteStream): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/unbound-method
    const write = (stream as any).__write ?? stream.write;

    return write.call(stream, data);
};
