import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const BRAND = '#7C5CFC';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND,
    onPrimary: '#FFFFFF',
    primaryContainer: '#E9E2FF',
    onPrimaryContainer: '#22005D',
    secondaryContainer: '#ECE6F9',
    background: '#FBFAFF',
    surface: '#FFFFFF',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#CDBDFF',
    onPrimary: '#38008E',
    primaryContainer: '#5A3AD6',
    onPrimaryContainer: '#E9E2FF',
    background: '#141218',
    surface: '#1D1B20',
  },
};
