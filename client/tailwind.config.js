/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        coral: "#F86C5B",
        sand: "#F7F1E8",
        teal: "#1F8A88",
        mist: "#E4EDF5"
      },
      boxShadow: {
        panel: "0 20px 60px rgba(20, 33, 61, 0.08)"
      },
      fontFamily: {
        display: ['"Segoe UI"', "sans-serif"],
        body: ['"Trebuchet MS"', "sans-serif"]
      }
    }
  },
  plugins: []
};