// import CssBaseline from "@mui/material/CssBaseline";
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { router } from './routes.tsx'

import { TickProvider } from './common.tsx';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: { root: { paddingTop: 0, paddingBottom: 0 } },
      defaultProps: {
        size: 'small',
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      }
    },
    MuiCheckbox: {
      styleOverrides: { root: { width: '1em', height: '1em' } },
    },
  },
});


ReactDOM.createRoot(document.getElementById('tasks-root')!).render( // eslint-disable-line @typescript-eslint/no-non-null-assertion
  <React.StrictMode>
    <ClerkProvider publishableKey="pk_test_dG9wLWdhbm5ldC0zMi5jbGVyay5hY2NvdW50cy5kZXYk">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TickProvider>
          <ThemeProvider theme={theme}>
            <RouterProvider router={router} />
          </ThemeProvider>
        </TickProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
)
