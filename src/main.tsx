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

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById('tasks-root')!).render( // eslint-disable-line @typescript-eslint/no-non-null-assertion
  <React.StrictMode>
    <ClerkProvider publishableKey="pk_test_dG9wLWdhbm5ldC0zMi5jbGVyay5hY2NvdW50cy5kZXYk">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TickProvider>
          <RouterProvider router={router} />
        </TickProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
)
