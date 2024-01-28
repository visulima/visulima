export const writeStream = (data: string, stream: NodeJS.WriteStream): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/unbound-method
    const write = (stream as any).__write ?? stream.write;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return write.call(stream, data);
};
