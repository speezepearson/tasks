import { Box, Container, Stack } from "@mui/material";
import { Link, Outlet } from "react-router-dom";

export function Root() {
    return <Container maxWidth="lg" sx={{ fontFamily: 'Arial' }}>
        <header>
            <Stack direction="row" alignItems="center">
                <Box><Link to="/">Home</Link></Box>
                <Box sx={{ ml: 2 }}><Link to="/add">Quick Capture</Link></Box>
            </Stack>
        </header>
        <main>
            <Outlet />
        </main>
        <footer>
            {/* footer stuff */}
        </footer>
    </Container>
}