declare module "regexparam" {
    // eslint-disable-next-line import/prefer-default-export
    export function parse(
        route: RegExp | string,
        loose?: boolean,
    ): {
        keys: string[] | false;
        pattern: RegExp;
    };
}
