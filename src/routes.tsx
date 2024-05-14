import { createHashRouter } from "react-router-dom";
import { Root } from "./Root";
import * as Home from "./pages/Home";
import { Id } from "../convex/_generated/dataModel";

// // eslint-disable-next-line react-refresh/only-export-components
// function WrapElement<T>({ element }: { element: (props: T) => ReactNode }): ReactNode {
//     return element(useLoaderData() as T);
// }

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
                element: <Home.Page />,
            },
        ],
    },
]);
