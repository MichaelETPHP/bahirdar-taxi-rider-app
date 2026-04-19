/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00674F",
        secondary: "#FFD700", // Example Bahirdar secondary color
      },
      fontFamily: {
        italic: ["italic"], // Matches your typography mapping
      },
    },
  },
  plugins: [],
};
