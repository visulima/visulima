const writeStream = (data: string, stream: NodeJS.WriteStream): boolean => {
    const write: NodeJS.WriteStream["write"]
        = ((stream as unknown as Record<string, unknown>)["__write"] as NodeJS.WriteStream["write"] | undefined) ?? stream.write.bind(stream);

    return write.call(stream, data);
};

export default writeStream;
