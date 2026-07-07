/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#007AFF", // iOS blue as default primary
        background: "#F2F2F7", // iOS grouped background
        card: "#FFFFFF",
        text: {
          DEFAULT: "#1C1C1E",
          primary: "#1C1C1E",
          secondary: "#6E6E73",
        },
        border: {
          DEFAULT: "#C6C6C8",
          light: "#E5E5EA",
        },
      }
    },
  },
  plugins: [],
}
