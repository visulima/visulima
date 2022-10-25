declare module "regexparam" {
// eslint-disable-next-line import/prefer-default-export
    export function parse(
        route: string | RegExp,
        loose?: boolean,
    ): {
        keys: string[] | false;
        pattern: RegExp;
    };
}
