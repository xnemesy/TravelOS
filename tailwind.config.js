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
        text: "#1C1C1E",
        border: "#C6C6C8",
      }
    },
  },
  plugins: [],
}
