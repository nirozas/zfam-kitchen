import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { ShieldAlert, User, UserPlus, Shield, X, Search, Copy, Trash2, Mail, Loader2, ChefHat, Heart, MessageSquare, Bug } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import AdminBugReports from '@/components/AdminBugReports';
import { deleteFromB2 } from '@/lib/b2';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [allUsers, setAllUsers] = useState<(Profile & { recipe_count: number; review_count: number; likes_given: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'members' | 'bugs'>('members');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'admins'>('all');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        checkAdmin();
        fetchAllUsers();
    }, []);

    const checkAdmin = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                alert(`Error checking admin status: ${error.message}. Did you run the migration script?`);
                return;
            }

            if (profile?.role !== 'admin') {
                alert("Access Denied: You are not an admin.");
                navigate('/');
                return;
            }
            setIsAdmin(true);
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('An unexpected error occurred while checking permissions.');
        }
    };

    const fetchAllUsers = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                recipes:recipes(count),
                reviews:reviews(count),
                favorites:favorites(count)
            `)
            .order('updated_at', { ascending: false });

        if (error) console.error('Error fetching users:', error);
        else {
            const formattedUsers = (data || []).map((u: any) => ({
                ...u,
                recipe_count: u.recipes?.[0]?.count || 0,
                review_count: u.reviews?.[0]?.count || 0,
                likes_given: u.favorites?.[0]?.count || 0
            }));
            setAllUsers(formattedUsers);
        }
        setLoading(false);
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_approved: !currentStatus })
            .eq('id', userId);

        if (error) {
            alert('Error updating user status');
            console.error(error);
        } else {
            setAllUsers(allUsers.map(u => u.id === userId ? { ...u, is_approved: !currentStatus } : u));
        }
    };

    const toggleUserRole = async (userId: string, currentRole: 'user' | 'admin') => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            alert('Error updating user role');
            console.error(error);
        } else {
            setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) return;

        try {
            // 1. Fetch all recipes authored by this user
            const { data: userRecipes } = await supabase
                .from('recipes')
                .select('image_url, gallery_urls, steps')
                .eq('author_id', userId);

            if (userRecipes && userRecipes.length > 0) {
                const imagesToDelete: string[] = [];
                userRecipes.forEach(recipe => {
                    if (recipe.image_url) imagesToDelete.push(recipe.image_url);
                    
                    if (recipe.gallery_urls && Array.isArray(recipe.gallery_urls)) {
                        recipe.gallery_urls.forEach((item: any) => {
                            if (item.url) imagesToDelete.push(item.url);
                        });
                    }
                    
                    if (recipe.steps && Array.isArray(recipe.steps)) {
                        recipe.steps.forEach((step: any) => {
                            if (step.image_url) imagesToDelete.push(step.image_url);
                        });
                    }
                });

                // Fire and forget deletions
                if (imagesToDelete.length > 0) {
                    Promise.all(imagesToDelete.map(url => deleteFromB2(url))).catch(err => {
                        console.error('Failed to clean up user B2 images:', err);
                    });
                }
            }

            // 2. Delete the user (this will cascade delete recipes in DB)
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                alert('Error deleting user');
                console.error(error);
            } else {
                setAllUsers(allUsers.filter(u => u.id !== userId));
            }
        } catch (err) {
            console.error('Error in user deletion flow:', err);
            alert('An error occurred while deleting the user.');
        }
    };

    const filteredUsers = allUsers.filter(u => {
        const query = searchTerm.toLowerCase();
        const matchesSearch = (u.username?.toLowerCase() || '').includes(query) || u.id.toLowerCase().includes(query);
        if (activeTab === 'pending') return matchesSearch && !u.is_approved;
        if (activeTab === 'admins') return matchesSearch && u.role === 'admin';
        return matchesSearch;
    });

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;

        setIsInviting(true);
        // In a real app, you would:
        // 1. Check if user already exists
        // 2. Generate a token
        // 3. Send email via a Supabase Edge Function or external service

        setTimeout(() => {
            alert(`Invitation sent to ${inviteEmail}! (Simulated)`);
            setInviteEmail('');
            setIsInviting(false);
            setShowInviteModal(false);
        }, 800);
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 pt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                            <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-200">
                                <ShieldAlert size={32} />
                            </div>
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-500 font-medium mt-2">Manage your kitchen community and user access.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex p-1 bg-gray-100 rounded-2xl">
                            <button 
                                onClick={() => setViewMode('members')}
                                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'members' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Members
                            </button>
                            <button 
                                onClick={() => setViewMode('bugs')}
                                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'bugs' ? 'bg-white text-rose-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <Bug size={14} /> Bug Squash
                            </button>
                        </div>
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200"
                        >
                            <UserPlus size={20} />
                            Invite Member
                        </button>
                    </div>
                </div>

                {viewMode === 'members' ? (
                    <>
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            {[
                                { label: 'Total Members', value: allUsers.length, icon: User, color: 'text-primary-600', bg: 'bg-primary-50' },
                                { label: 'Pending Approvals', value: allUsers.filter(u => !u.is_approved).length, icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50' },
                                { label: 'Administrators', value: allUsers.filter(u => u.role === 'admin').length, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                            ].map((s, i) => (
                                <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
                                    <div className={`p-4 ${s.bg} ${s.color} rounded-2xl`}>
                                        <s.icon size={24} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-black text-gray-900">{s.value}</div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Controls */}
                        <div className="bg-white p-4 rounded-[2.5rem] border border-gray-100 shadow-sm mb-8 space-y-4">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by name or ID..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-6 py-3 bg-gray-50 rounded-2xl border border-transparent focus:bg-white focus:border-primary-100 focus:outline-none font-medium transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-2xl">
                                    {[
                                        { id: 'all', label: 'All Users' },
                                        { id: 'pending', label: 'Pending' },
                                        { id: 'admins', label: 'Admins' }
                                    ].map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTab(t.id as any)}
                                            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Activity</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                            <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                                            <th className="px-8 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-black text-xl">
                                                            {user.username?.[0]?.toUpperCase() || 'N'}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-gray-900">{user.username || 'Anonymous Chef'}</div>
                                                            <div className="text-xs font-medium text-gray-400 font-mono tracking-tighter uppercase">{user.id.slice(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4 font-bold text-gray-600">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="p-1.5 bg-orange-50 rounded-lg" title="Recipes">
                                                                <ChefHat size={14} className="text-orange-500" />
                                                            </div>
                                                            <span className="text-[10px]">{user.recipe_count}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="p-1.5 bg-rose-50 rounded-lg" title="Likes Given">
                                                                <Heart size={14} className="text-rose-500" />
                                                            </div>
                                                            <span className="text-[10px]">{user.likes_given}</span>
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="p-1.5 bg-indigo-50 rounded-lg" title="Reviews Given">
                                                                <MessageSquare size={14} className="text-indigo-500" />
                                                            </div>
                                                            <span className="text-[10px]">{user.review_count}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => toggleUserStatus(user.id, user.is_approved)}
                                                        className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${user.is_approved
                                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                                            }`}
                                                    >
                                                        {user.is_approved ? 'Approved' : 'Pending'}
                                                    </button>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => toggleUserRole(user.id, user.role)}
                                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${user.role === 'admin'
                                                            ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {user.role === 'admin' && <Shield size={12} />}
                                                        {user.role}
                                                    </button>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <button
                                                        onClick={() => deleteUser(user.id)}
                                                        className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="Remove User"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-medium italic">
                                                    No users found matching your criteria.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <AdminBugReports />
                )}

                {/* Invite Modal */}
                <AnimatePresence>
                    {showInviteModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Invite Member</h3>
                                    <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                        <X size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                <p className="text-gray-500 text-sm font-medium mb-8">
                                    Enter the email of the person you want to invite to the family kitchen.
                                </p>

                                <form onSubmit={handleInvite} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Email Address</label>
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                required
                                                type="email"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                placeholder="cousin@example.com"
                                                className="w-full pl-12 pr-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 focus:bg-white focus:border-primary-100 focus:outline-none font-bold transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Or share registration link</label>
                                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 break-all text-xs font-mono text-gray-600 relative group flex items-center justify-between gap-4">
                                            <span className="truncate">{window.location.origin}/auth</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/auth`);
                                                    alert('Link copied to clipboard!');
                                                }}
                                                className="shrink-0 p-2 bg-white rounded-lg shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors"
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isInviting}
                                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isInviting ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
                                        Send Invitation
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
