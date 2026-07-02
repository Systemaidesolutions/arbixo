import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Extracted directly from the Arbixo logo, not guessed:
        // navy from the "A" and wordmark, blue from the "R" gradient
        // and the "x" left half, green from the arrow/globe and the
        // "x" right half.
        brand: {
          navy: "#0B2A5E",
          navyLight: "#123A73",
          blue: "#1C9AD6",
          green: "#35B07A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
