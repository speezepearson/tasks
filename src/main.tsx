import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConvexProvider, ConvexReactClient } from "convex/react";

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { router } from './routes.tsx'

import { TickProvider } from './common.tsx';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById('tasks-root')!).render( // eslint-disable-line @typescript-eslint/no-non-null-assertion
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <TickProvider>
        <RouterProvider router={router} />
      </TickProvider>
    </ConvexProvider>
  </React.StrictMode>,
)
