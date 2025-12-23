"use client";

import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
            setIsDark(true);
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setIsDark(prev => {
            const newTheme = !prev;
            document.documentElement.setAttribute("data-theme", newTheme ? "dark" : "light");
            localStorage.setItem("theme", newTheme ? "dark" : "light");
            return newTheme;
        });
    }, []);

    return { isDark, mounted, toggleTheme };
}
