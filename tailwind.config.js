/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2F70C7",
        secondary: "#5899FE",
      },
      fontFamily: {
        italic: ["italic"], // Matches your typography mapping
      },
    },
  },
  plugins: [],
};
