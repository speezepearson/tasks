import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render( // eslint-disable-line @typescript-eslint/no-non-null-assertion
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
