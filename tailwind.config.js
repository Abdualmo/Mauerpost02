/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: "#F5F0E8",
        card: "#FFFFFF",
        gold: {
          DEFAULT: "#C8A96B",
          hover: "#B8975A",
          soft: "#F2EBDD",
          softer: "#F7F3ED",
          softest: "#FBF7F0",
          tint: "#EEE5D8",
          past: "#E8DDC8",
          absent: "#FBE3A8",
          dark: "#A68445",
        },
        teal: {
          company: "#5E9EA0",
        },
        red: {
          sick: "#D64545",
        },
      },
      boxShadow: {
        card: "0 4px 20px -6px rgba(0,0,0,0.08)",
        soft: "0 1px 3px rgba(0,0,0,0.05)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
