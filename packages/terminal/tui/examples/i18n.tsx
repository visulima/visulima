// @ts-nocheck

/* eslint-disable func-style, sonarjs/prefer-read-only-props, unicorn/no-process-exit, sonarjs/void-use -- demo file using legacy patterns */

/**
 * Internationalization with react-i18next.
 *
 * Runnable demo of the i18n pattern documented in `docs/i18n.mdx`.
 *
 * Install the peer deps before running:
 *   pnpm add i18next react-i18next
 *
 * Run:
 *   pnpm tsx packages/terminal/tui/examples/i18n.tsx
 *   LANG=fr_FR.UTF-8 pnpm tsx packages/terminal/tui/examples/i18n.tsx
 *   LANG=de_DE.UTF-8 pnpm tsx packages/terminal/tui/examples/i18n.tsx
 */
import { Box, Text, useInput } from "@visulima/tui";
import { render } from "@visulima/tui/react";
import i18next from "i18next";
import React, { useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";

// Detect the user's locale from the shell environment. Never use
// i18next-browser-languagedetector in a TUI — it reaches for localStorage.
const resolveLocale = (): string => {
    const raw = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG ?? "en";

    return (raw.split(".")[0] ?? "en").replace("_", "-").split("-")[0] ?? "en";
};

// Inline resources keep the example self-contained. For a real app move
// these into locales/<lng>/<ns>.json and load them with i18next-fs-backend.
const resources = {
    de: {
        translation: {
            commit_one: "{{count}} Commit",
            commit_other: "{{count}} Commits",
            greeting: "Hallo, {{name}}!",
            help: "Drücke e/f/d/j/r zum Sprachwechsel, q zum Beenden.",
            status: "Status: {{state}}",
            title: "Willkommen bei @visulima/tui",
        },
    },
    en: {
        translation: {
            commit_one: "{{count}} commit",
            commit_other: "{{count}} commits",
            greeting: "Hello, {{name}}!",
            help: "Press e/f/d/j/r to switch language, q to quit.",
            status: "Status: {{state}}",
            title: "Welcome to @visulima/tui",
        },
    },
    fr: {
        translation: {
            commit_one: "{{count}} commit",
            commit_other: "{{count}} commits",
            greeting: "Bonjour, {{name}} !",
            help: "Appuie sur e/f/d/j/r pour changer de langue, q pour quitter.",
            status: "Statut : {{state}}",
            title: "Bienvenue sur @visulima/tui",
        },
    },
    ja: {
        translation: {
            commit_one: "コミット {{count}} 件",
            commit_other: "コミット {{count}} 件",
            greeting: "こんにちは、{{name}}さん！",
            help: "e/f/d/j/r で言語を切り替え、q で終了します。",
            status: "ステータス: {{state}}",
            title: "@visulima/tui へようこそ",
        },
    },
    ru: {
        translation: {
            commit_few: "{{count}} коммита",
            commit_many: "{{count}} коммитов",
            commit_one: "{{count}} коммит",
            greeting: "Здравствуйте, {{name}}!",
            help: "Нажмите e/f/d/j/r для смены языка, q для выхода.",
            status: "Статус: {{state}}",
            title: "Добро пожаловать в @visulima/tui",
        },
    },
};

await i18next.init({
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    lng: resolveLocale(),
    resources,
});

const LANGUAGES: ReadonlyArray<{ code: keyof typeof resources; hotkey: string; name: string }> = [
    { code: "en", hotkey: "e", name: "English" },
    { code: "fr", hotkey: "f", name: "Français" },
    { code: "de", hotkey: "d", name: "Deutsch" },
    { code: "ja", hotkey: "j", name: "日本語" },
    { code: "ru", hotkey: "r", name: "Русский" },
];

function LocaleSwitcher({ current }: { current: string }) {
    return (
        <Box gap={2} marginTop={1}>
            {LANGUAGES.map((language) => {
                const isActive = current.startsWith(language.code);

                return (
                    <Box key={language.code}>
                        <Text color={isActive ? "cyan" : undefined} dimColor={!isActive}>
                            [
{language.hotkey}
]
{" "}
{language.name}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}

function Demo() {
    const { i18n, t } = useTranslation();
    const [count, setCount] = useState(1);

    useInput((input) => {
        if (input === "q") {
            process.exit(0);
        }

        const match = LANGUAGES.find((language) => language.hotkey === input);

        if (match) {
            void i18n.changeLanguage(match.code);

            return;
        }

        if (input === "+") {
            setCount((previous) => previous + 1);
        } else if (input === "-") {
            setCount((previous) => Math.max(0, previous - 1));
        }
    });

    return (
        <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
            <Text bold color="cyan">
                {t("title")}
            </Text>
            <Text>{t("greeting", { name: "Ada" })}</Text>
            <Text dimColor>{t("status", { state: i18n.language })}</Text>
            <Text>
                {t("commit", { count })}
                {"  "}
                <Text dimColor>(press +/- to change count)</Text>
            </Text>
            <LocaleSwitcher current={i18n.language} />
            <Box marginTop={1}>
                <Text dimColor>{t("help")}</Text>
            </Box>
        </Box>
    );
}

render(
    <I18nextProvider i18n={i18next}>
        <Demo />
    </I18nextProvider>,
);
