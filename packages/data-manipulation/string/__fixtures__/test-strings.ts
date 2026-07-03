export const TEST_STRINGS = [
    "foo bar",
    "Foo Bar",
    "fooBar",
    "FooBar",
    "foo-bar",
    "FOO_BAR",
    "foo.bar",
    "foo_bar",
    "foo🎉bar",
    "foo\u001B[31mbar\u001B[0m", // ANSI colored string
    "foo__bar___baz",
    "FOO_BAR_BAZ",
    "foo.bar.baz",
    "fooBarBaz",
    "Foo Bar Baz",
    "foo-bar-baz",
    "foo_Bar_Baz",
    "foo-Bar-Baz",
    "foo.Bar.Baz",
    "FooBarBaz",
    "fooBARBaz",
    "FOOBarBAZ",
    "foo_barBaz",
    "foo-barBaz",
    "foo.barBaz",
    "FOO BAR BAZ",
] as const;

export const SPECIAL_STRINGS = ["foo\u001B[31mbar\u001B[0m", "foo🎉bar", "foo💻bar_baz"] as const;

export const ACRONYM_STRINGS = ["XMLHttpRequest", "APIClient", "OAuth2Provider", "GraphQLAPI", "MySQLDB"] as const;
