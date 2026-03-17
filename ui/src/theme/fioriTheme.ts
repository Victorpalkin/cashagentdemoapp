import { createTheme } from '@mui/material/styles'

export const fioriTheme = createTheme({
  palette: {
    primary: {
      main: '#0070F2',
      light: '#4A9FFF',
      dark: '#0054B4',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1D2D3E',
      light: '#354A5F',
      dark: '#0F1A24',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#36A41D',
      light: '#5FB345',
      dark: '#2B7F16',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#E76500',
      light: '#FF9A3D',
      dark: '#B34F00',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#CC1919',
      light: '#E54646',
      dark: '#A01313',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0070F2',
      light: '#4A9FFF',
      dark: '#0054B4',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F6F7',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1D2D3E',
      secondary: '#6A6D70',
    },
    divider: '#D9DADB',
  },
  typography: {
    fontFamily: '"72", "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '8px 16px',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 0 0 1px rgba(29, 45, 62, 0.08), 0 1px 2px 0 rgba(29, 45, 62, 0.08)',
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F5F6F7',
          color: '#1D2D3E',
        },
      },
    },
  },
})
