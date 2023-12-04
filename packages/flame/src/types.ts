export type Solution = {
    body: string;
    header?: string;
};

export type Theme = "dark" | "light";
export enum Editor {
    "android-studio" = "Android Studio",
    "atom" = "Atom",
    "emacs" = "GNU Emacs",
    "emacsforosx" = "GNU Emacs for Mac OS X",
    "intellij" = "IntelliJ IDEA",
    "nano" = "GNU nano",
    "neovim" = "NeoVim",
    "sublime" = "SublimeText",
    // "phpstorm" = "PHPStorm", @TODO: Add PHPStorm into https://github.com/sindresorhus/env-editor
    "textmate" = "TextMate",
    "vim" = "Vim",
    "vscode" = "Visual Studio Code",
    "vscodium" = "VSCodium",
    "webstorm" = "WebStorm",
    "xcode" = "Xcode",
}

export type SolutionFinderFile = {
    file: string;
    language?: string;
    line: number;
    snippet?: string | undefined;
};

export type SolutionFinder = {
    handle: (error: any, file: SolutionFinderFile) => Promise<Solution | undefined>;
    name: string;
    priority: number;
};

export type SolutionError = Error & {
    hint?: Solution;
};
