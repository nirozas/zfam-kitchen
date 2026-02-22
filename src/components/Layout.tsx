import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from './Navbar';
import MobileNav from './MobileNav';
import toast from 'react-hot-toast';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const checkApproval = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            // Skip check for auth page to avoid loops
            if (location.pathname === '/auth') return;

            if (session?.user) {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('is_approved')
                    .eq('id', session.user.id)
                    .single();

                if (error) {
                    console.error('Error fetching profile:', error);
                    return;
                }

                if (profile && !profile.is_approved) {
                    await supabase.auth.signOut();
                    toast.error('Your account is pending admin approval.');
                    navigate('/auth');
                }
            }
        };

        checkApproval();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                checkApproval();
            }
        });

        return () => subscription.unsubscribe();
    }, [location.pathname, navigate]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 pb-[calc(5rem+var(--safe-bottom))] sm:pb-0 font-sans pt-[var(--safe-top)]">
            <Navbar />
            <main className="pt-20 min-h-[calc(100vh-64px)]">
                <Outlet />
            </main>
            <MobileNav />
        </div>
    );
}
