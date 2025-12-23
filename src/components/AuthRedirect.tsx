"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export function AuthRedirect() {
    const { isSignedIn, isLoaded } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            router.push('/chat');
        }
    }, [isLoaded, isSignedIn, router]);

    return null;
}
