export type Hint = {
    header?: string;
    body: string;
};

export type Theme = "dark" | "light";
export enum Editor {
    "sublime" = "SublimeText",
    "atom" = "Atom",
    "vscode" = "Visual Studio Code",
    "vscodium" = "VSCodium",
    "webstorm" = "WebStorm",
    // "phpstorm" = "PHPStorm", @TODO: Add PHPStorm into https://github.com/sindresorhus/env-editor
    "textmate" = "TextMate",
    "vim" = "Vim",
    "neovim" = "NeoVim",
    "intellij" = "IntelliJ IDEA",
    "nano" = "GNU nano",
    "emacs" = "GNU Emacs",
    "emacsforosx" = "GNU Emacs for Mac OS X",
    "android-studio" = "Android Studio",
    "xcode" = "Xcode",
}
