// Clerk appearance configuration - defined once to avoid recreating on every render
// Updated to use new brown color scheme
export const clerkAppearance = {
    elements: {
        rootBox: {
            backgroundColor: "#faf9f5",
        },
        card: {
            backgroundColor: "#faf9f5",
            boxShadow: "0 8px 40px rgba(20, 20, 19, 0.12)",
        },
        headerTitle: {
            color: "#141413",
        },
        headerSubtitle: {
            color: "#6b6963",
        },
        formFieldLabel: {
            color: "#141413",
        },
        formFieldInput: {
            backgroundColor: "#e8e6dc",
            borderColor: "#b0aea5",
            color: "#141413",
        },
        formButtonPrimary: {
            backgroundColor: "#8B5E3C",
            "&:hover": {
                backgroundColor: "#6F4C2E",
            },
        },
        footerActionLink: {
            color: "#8B5E3C",
        },
        modalBackdrop: {
            backgroundColor: "rgba(20, 20, 19, 0.6)",
        },
    },
} as const;
