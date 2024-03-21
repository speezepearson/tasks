import { Link, Outlet } from "react-router-dom";

export function Root() {
    return <>
        <header>
            <Link to="/">Home</Link>
        </header>
        <main>
            <Outlet />
        </main>
        <footer>
            {/* footer stuff */}
        </footer>
    </>
}