/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Playfair Display', 'serif'], // High-contrast serif aesthetic
                serif: ['Playfair Display', 'serif'],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: '#e95454',
                    foreground: '#ffffff',
                    50: '#fdf4f4',
                    100: '#fce7e7',
                    200: '#fad3d3',
                    300: '#f6b0b0',
                    400: '#f18383',
                    500: '#e95454',
                    600: '#d73535',
                    700: '#b42626',
                    800: '#952323',
                    900: '#7c2222',
                },
                secondary: {
                    DEFAULT: '#f1f5f9',
                    foreground: '#0f172a',
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: '#f1f5f9',
                    foreground: '#64748b',
                },
                accent: {
                    DEFAULT: '#f1f5f9',
                    foreground: '#0f172a',
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
        },
    },
    plugins: [],
}
