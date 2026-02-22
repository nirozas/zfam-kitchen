import { Home, Search, Calendar, User, Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export default function MobileNav() {
    const location = useLocation();
    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="fixed bottom-0 left-0 right-0 lg:hidden glass z-[100] border-t border-gray-100 pb-[var(--safe-bottom)]">
            <div className="flex items-center justify-around h-20 px-4">
                <Link to="/" className={clsx("flex flex-col items-center gap-1", isActive('/') ? "text-primary-600" : "text-gray-400")}>
                    <Home size={24} />
                    <span className="text-[10px] font-medium">Home</span>
                </Link>
                <Link
                    to="/search"
                    className={clsx("flex flex-col items-center gap-1 transition-colors", isActive('/search') ? "text-primary-600" : "text-gray-400")}
                >
                    <Search size={22} />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Search</span>
                </Link>
                <Link
                    to="/create"
                    className="flex flex-col items-center -mt-8"
                >
                    <div className="w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white transition-transform active:scale-90">
                        <Plus size={28} strokeWidth={3} />
                    </div>
                </Link>
                <Link
                    to="/planner"
                    className={clsx("flex flex-col items-center gap-1 transition-colors", isActive('/planner') ? "text-primary-600" : "text-gray-400")}
                >
                    <Calendar size={22} />
                    <span className="text-[9px] font-bold uppercase tracking-tight">Planner</span>
                </Link>
                <Link
                    to="/profile"
                    className={clsx("flex flex-col items-center gap-1 transition-colors", isActive('/profile') ? "text-primary-600" : "text-gray-400 hover:text-gray-600")}
                >
                    <User size={24} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">Profile</span>
                </Link>
            </div>
        </nav>
    );
}
