import { Link, Outlet } from "react-router-dom";

export function Root() {
    return <>
        <header>
            <Link to="/">Home</Link>
            <Link className="ms-2" to="/add">Quick Capture</Link>
        </header>
        <main className="container">
            <Outlet />
        </main>
        <footer>
            {/* footer stuff */}
        </footer>
    </>
}