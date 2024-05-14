import { SignInButton, SignOutButton } from "@clerk/clerk-react";
import { Box, Button, Container, Paper, Stack } from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { useStoreUserEffect } from "./useStoreUserEffect";

export function Root() {
    const { isLoading, isAuthenticated } = useStoreUserEffect();

    return <Container maxWidth="lg" sx={{ fontFamily: 'Arial' }}>
        <Paper component="header" sx={{ p: 1, mb: 1 }}>
            <Stack direction="row" alignItems="center">
                <Box><Link to="/">Home</Link></Box>
                <Box sx={{ ml: 2 }}><Link to="/add">Quick Capture</Link></Box>
                <Box sx={{ ml: 'auto' }}>
                    {isLoading ? "Loading..." : isAuthenticated
                        ? <SignOutButton><Button sx={{ py: 1 }} size="medium" variant="outlined">sign out</Button></SignOutButton>
                        : <SignInButton><Button sx={{ py: 1 }} size="medium" variant="contained">sign in</Button></SignInButton>
                    }
                </Box>
            </Stack>
        </Paper>
        <main>
            <Outlet />
        </main>
        <footer>
            {/* footer stuff */}
        </footer>
    </Container>
}