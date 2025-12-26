import { useState, useEffect } from 'react';

type ConnectionStyle = 'orbit' | 'smoothstep';

export function useConnectionStyle() {
    const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>('smoothstep');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('arbor_connection_style') as ConnectionStyle;
        if (saved && (saved === 'orbit' || saved === 'smoothstep')) {
            setConnectionStyle(saved);
        }
    }, []);

    const toggleStyle = () => {
        const newStyle = connectionStyle === 'smoothstep' ? 'orbit' : 'smoothstep';
        setConnectionStyle(newStyle);
        localStorage.setItem('arbor_connection_style', newStyle);
    };

    return { connectionStyle, toggleStyle, mounted };
}
