import { ReactNode } from "react";
import { createHashRouter, useLoaderData } from "react-router-dom";
import { Root } from "./Root";
import * as Home from "./pages/Home";
import * as Add from "./pages/QuickCapture";
import * as Parameterized from "./pages/Project";
import { Id } from "../convex/_generated/dataModel";
import { Authenticated } from "convex/react";

// eslint-disable-next-line react-refresh/only-export-components
function WrapElement<T>({ element }: { element: (props: T) => ReactNode }): ReactNode {
    return element(useLoaderData() as T);
}

export function getProjectUrl(id: Id<'projects'>) {
    return `/project/${id}`;
}

export const router = createHashRouter([
    {
        path: "/",
        element: <Root />,
        children: [
            {
                path: "/",
                element: <Authenticated><Home.Page /></Authenticated>,
            },
            {
                path: "/add",
                element: <Authenticated><Add.Page /></Authenticated>,
            },
            {
                path: getProjectUrl(':id' as Id<'projects'>),
                loader: ({ params }): Parameterized.Props => ({ id: params.id! as Id<'projects'> }), // eslint-disable-line @typescript-eslint/no-non-null-assertion
                element: <WrapElement element={(props: Parameterized.Props) => <Parameterized.Page {...props} />} />,
            },
        ],
    },
]);
