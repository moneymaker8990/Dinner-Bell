// Warm "dinner bell" palette: cream, warm brown text, amber/brass accent
const tintColorLight = '#B8860B'; // dark goldenrod / brass
const tintColorDark = '#E8C547'; // warm amber for dark mode

// Semantic accents from prompt
const honeyGold = '#C79A2B';
const sageGreen = '#4F7D6A';
const tomato = '#D45A4E';

export default {
  light: {
    text: '#1B1B1B',
    textPrimary: '#1B1B1B',
    textSecondary: '#6B645C',
    background: '#F2EDE6',
    surface: '#FAF6F0',
    surface2: '#F8F4EE',
    tint: honeyGold,
    tabIconDefault: '#9A8F7E',
    tabIconSelected: honeyGold,
    card: '#FFFBF5',
    inputBorder: '#E8E1D8',
    border: '#E8E1D8',
    primaryButton: honeyGold,
    primaryButtonText: '#fff',
    secondaryText: '#6B645C',
    accentSage: sageGreen,
    accentTomato: tomato,
    tabBarBackground: '#FAF6F0',
    tabBarBorder: '#E8E1D8',
  },
  dark: {
    text: '#F5EFE6',
    textPrimary: '#F5EFE6',
    textSecondary: '#C4B8A8',
    background: '#2C2419',
    surface: '#3D3629',
    surface2: '#362E22',
    tint: tintColorDark,
    tabIconDefault: '#9A8F7E',
    tabIconSelected: tintColorDark,
    card: '#3D3629',
    inputBorder: '#5C5346',
    border: '#5C5346',
    primaryButton: tintColorDark,
    primaryButtonText: '#2C2419',
    secondaryText: '#C4B8A8',
    accentSage: '#5F9078',
    accentTomato: '#E07064',
    tabBarBackground: '#2C2419',
    tabBarBorder: '#5C5346',
  },
};
