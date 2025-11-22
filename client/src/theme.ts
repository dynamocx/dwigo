import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#0d47a1',
    },
    secondary: {
      main: '#fe5b39',
      light: '#ff8a65',
      dark: '#c52f12',
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 700 },
    h2: { fontSize: '1.75rem', fontWeight: 700 },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    h4: { fontSize: '1.25rem', fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(25, 118, 210, 0.08)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          '&.Mui-selected': {
            color: '#1976d2',
          },
        },
      },
    },
  },
});

export default theme;

