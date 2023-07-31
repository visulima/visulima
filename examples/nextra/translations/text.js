/**
 * @typedef {"en-US"} DefaultLocale
 * @typedef {DefaultLocale | "zh-CN" | "es-ES" | "ru"} Locale
 */

/** @type {Readonly<Record<Locale, string>>} */
export const languageMap = {
    "en-US": "English",
    "es-ES": "Español",
    "zh-CN": "简体中文",
    ru: "Русский",
};

/** @type {Readonly<Record<Locale, string>>} */
export const titleMap = {
    "en-US": "React Hooks for Data Fetching",
    "es-ES": "Biblioteca React Hooks para la obtención de datos",
    "zh-CN": "用于数据请求的 React Hooks 库",
    ru: "React хуки для выборки данных",
};

/** @type {Readonly<Record<Locale, {lightweight:string;realtime?:string;suspense?:string;pagination?:string;backendAgnostic?:string;renderingStrategies?:string;typescript?:string;remoteLocal?:string;}>>} */
export const featuresMap = {
    "en-US": {
        lightweight: "Lightweight",
        realtime: "Realtime",
        suspense: "Suspense",
        pagination: "Pagination",
        backendAgnostic: "Backend Agnostic",
        renderingStrategies: "SSR / SSG Ready",
        typescript: "TypeScript Ready",
        remoteLocal: "Remote + Local",
    },
    ru: {
        lightweight: "Лёгкий",
        realtime: "В реальном времени",
        suspense: "Задержка",
        pagination: "Пагинация",
        backendAgnostic: "Бэкэнд-независимый",
        renderingStrategies: "SSR / SSG",
        typescript: "TypeScript",
        remoteLocal: "Удалённо + Локально",
    },
};

/** @type {Readonly<Record<Locale, string>>} */
export const headDescriptionMap = {
    "en-US":
        "SWR is a React Hooks library for data fetching. SWR first returns the data from cache (stale), then sends the fetch request (revalidate), and finally comes with the up-to-date data again.",
    ru: "SWR — это библиотека React хуков для получения данных. SWR сначала возвращает данные из кеша (устаревшие), затем отправляет запрос на выборку (ревалидация) и, наконец, снова получает актуальные данные.",
};

/** @type {Readonly<Record<Locale, string>>} */
export const feedbackLinkMap = {
    "en-US": "Question? Give us feedback →",
    "es-ES": "¿Dudas? Danos tu feedback →",
    "zh-CN": "有疑问？给我们反馈 →",
    ru: "Вопросы? Оставьте нам отзыв →",
};

/** @type {Readonly<Record<Locale, string>>} */
export const editTextMap = {
    "en-US": "Edit this page on GitHub →",
    "es-ES": "Edite esta página en GitHub →",
    "zh-CN": "在 GitHub 上编辑本页 →",
    ru: "Редактировать эту страницу на GitHub →",
};

/** @type {Readonly<Record<Locale, { utmSource: string; text: string; suffix?: string | undefined }>>} */
export const footerTextMap = {
    "en-US": { utmSource: "swr", text: "Powered by" },
    "es-ES": { utmSource: "swr_es-es", text: "Desarrollado por" },
    "zh-CN": { utmSource: "swr_zh-cn", text: "由", suffix: "驱动" },
    ru: { utmSource: "swr_ru", text: "Работает на" },
};

/** @type {Readonly<Record<Locale, string>>} */
export const tableOfContentsTitleMap = {
    "en-US": "On This Page",
    "es-ES": "En esta página",
    ru: "На этой странице",
};

/** @type {Readonly<Record<Locale, string>>} */
export const searchPlaceholderMap = {
    "en-US": "Search documentation...",
    "es-ES": "Buscar documento...",
    ru: "Искать в документации...",
};

/** @type {Readonly<Record<Locale, string>>} */
export const gitTimestampMap = {
    "en-US": "Last updated on",
    ru: "Последнее обновление",
};
