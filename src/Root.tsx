import { Link, Outlet } from "react-router-dom";

export function Root() {
    return <>
        <header>
            {/* header stuff */}
        </header>
        <main>
            <Outlet />
        </main>
        <footer>
            {/* footer stuff */}
        </footer>
    </>
}