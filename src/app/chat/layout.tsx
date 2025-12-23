import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default async function ChatLayout({ children }: { children: ReactNode }) {
    const { userId } = await auth();

    if (!userId) {
        redirect('/');
    }

    return (
        <div className="chat-layout">
            <Sidebar />
            <main className="chat-main">
                {children}
            </main>
        </div>
    );
}
