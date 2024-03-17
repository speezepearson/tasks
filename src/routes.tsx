import { ReactNode } from "react";
import { createBrowserRouter, useLoaderData } from "react-router-dom";
import { Root } from "./Root";
import * as Home from "./pages/Home";
import * as Parameterized from "./pages/Parameterized";

// eslint-disable-next-line react-refresh/only-export-components
function WrapElement<T>({ element }: { element: (props: T) => ReactNode }): ReactNode {
    return element(useLoaderData() as T);
}

export function getThingyUrl(id: string) {
    return `/thingy/${id}`;
}

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Root />,
        children: [
            {
                path: "/",
                element: <Home.Page />,
            },
            {
                path: getThingyUrl(':id'),
                loader: ({ params }): Parameterized.Props => ({ id: params.id! }), // eslint-disable-line @typescript-eslint/no-non-null-assertion
                element: <WrapElement element={(props: Parameterized.Props) => <Parameterized.Page {...props} />} />,
            },
        ],
    },
]);
