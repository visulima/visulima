export type Serializer = (data: any) => Buffer | Uint8Array | string;

export type Serializers = {
    regex: RegExp;
    serializer: Serializer;
}[];
