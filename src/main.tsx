import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConvexProvider, ConvexReactClient } from "convex/react";

import { router } from './routes.tsx'

import './main.css';
import { TickProvider } from './common.tsx';

console.log("SRP: hi");
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
console.log({ convex });

ReactDOM.createRoot(document.getElementById('tasks-root')!).render( // eslint-disable-line @typescript-eslint/no-non-null-assertion
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <TickProvider>
        <RouterProvider router={router} />
      </TickProvider>
    </ConvexProvider>
  </React.StrictMode>,
)
