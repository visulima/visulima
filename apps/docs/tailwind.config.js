/** @type {import('tailwindcss').Config} */
export default {
    content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx}", "./theme.config.tsx"],
    theme: {
        screens: {
            sm: "640px",
            md: "768px",
            lg: "1024px",
            xl: "1280px",
            "2xl": "1536px",
        },
        extend: {
            colors: {
                darker: {
                    700: "#171923",
                    800: "#12141c",
                    900: "#0c0d12",
                },
            },
        },
    },
    plugins: [],
    darkMode: "class",
};
