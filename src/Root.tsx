import { SignInButton, SignOutButton } from "@clerk/clerk-react";
import { Box, Button, Container, Stack } from "@mui/material";
import { useConvexAuth } from "convex/react";
import { Link, Outlet } from "react-router-dom";

export function Root() {
    const { isLoading, isAuthenticated } = useConvexAuth();

    return <Container maxWidth="lg" sx={{ fontFamily: 'Arial' }}>
        <header>
            <Stack direction="row" alignItems="center">
                <Box><Link to="/">Home</Link></Box>
                <Box sx={{ ml: 2 }}><Link to="/add">Quick Capture</Link></Box>
                <Box sx={{ ml: 'auto' }}>
                    {isLoading ? "Loading..." : isAuthenticated
                        ? <SignOutButton><Button variant="outlined">sign out</Button></SignOutButton>
                        : <SignInButton><Button variant="contained">sign in</Button></SignInButton>
                    }
                </Box>
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