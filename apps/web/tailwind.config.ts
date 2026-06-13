import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#f7f4ed",
        moss: "#3f5f4f",
        brass: "#a16207",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(31, 41, 51, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
