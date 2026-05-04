export type Serializer = (data: unknown) => Buffer | Uint8Array | string;

export type Serializers = {
    regex: RegExp;
    serializer: Serializer;
}[];
