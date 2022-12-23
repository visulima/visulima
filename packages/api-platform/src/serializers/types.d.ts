export type Serializer = (data: any) => string | Buffer | Uint8Array;

export type Serializers = {
    regex: RegExp;
    serializer: Serializer;
}[];
