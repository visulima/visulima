export interface BenchInterface {
    add: (name: string) => BenchInterface;
    constructor: (options: object) => (suiteName: string) => BenchInterface;
    run: () => void;
}
