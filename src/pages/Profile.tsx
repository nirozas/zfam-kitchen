import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { useNavigate } from 'react-router-dom';
import { Heart, ChefHat, Settings, Award, TrendingUp, DollarSign, LogOut, Loader2, Save, Star, Users, UserPlus, X, Mail, Copy, Trash2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RecipeCard from '@/components/RecipeCard';
import { useRecipes, useFavorites, useCategories, useUserStats } from '@/lib/hooks';
import { useShoppingCart } from '@/contexts/ShoppingCartContext';
import { useMealPlanner } from '@/contexts/MealPlannerContext';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProfilePage() {
    const navigate = useNavigate();
    const { recipes, loading: recipesLoading } = useRecipes();
    const { favorites, loading: favoritesLoading } = useFavorites();
    const { categories } = useCategories();
    const { cartItems } = useShoppingCart();
    const { plannedMeals, loading: plannerLoading } = useMealPlanner();

    const [profile, setProfile] = useState<Profile | null>(null);
    const { stats: myStats } = useUserStats(profile?.id);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'favorites' | 'my-recipes' | 'stats' | 'settings' | 'users'>('stats');
    const [allUsers, setAllUsers] = useState<(Profile & { recipe_count: number; review_count: number; likes_given: number; favorites_given: number })[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // Editable fields
    const [username, setUsername] = useState('');
    const [updating, setUpdating] = useState(false);

    // Password change
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Admin Invitation
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (profile?.role === 'admin' && activeTab === 'users') {
            fetchUsers();
        }
    }, [profile, activeTab]);

    const fetchUsers = async () => {
        setUsersLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                *,
                recipes:recipes(count),
                reviews:reviews(count),
                likes:likes(count)
            `)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('DEBUG: Profile fetchUsers Error:', error);
            setUsersLoading(false);
            return;
        }
        console.log('DEBUG: Profile fetchUsers Success:', data);
        const formattedUsers = data.map((u: any) => ({
            ...u,
            recipe_count: u.recipes?.[0]?.count || 0,
            review_count: u.reviews?.[0]?.count || 0,
            likes_given: u.likes?.[0]?.count || 0,
            favorites_given: 0
        }));
        setAllUsers(formattedUsers);
        setUsersLoading(false);
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('profiles')
            .update({ is_approved: !currentStatus })
            .eq('id', userId);

        if (error) alert('Error updating user');
        else fetchUsers();
    };

    const deleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this user? This cannot be undone.')) return;
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (error) alert('Error deleting user');
        else fetchUsers();
    };

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
            setUsername(data.username || '');
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!profile) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    username,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (error) throw error;
            setProfile(prev => prev ? { ...prev, username } : null);
            alert('Profile updated successfully!');
        } catch (err) {
            alert('Failed to update profile');
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPassword || newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }

        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('Password updated successfully!');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            alert('Failed to update password');
            console.error(err);
        } finally {
            setChangingPassword(false);
        }
    };

    // --- Computed Stats ---
    const favoriteRecipes = useMemo(() => recipes.filter(r => favorites.includes(r.id)), [recipes, favorites]);
    const myRecipes = useMemo(() => recipes.filter(r => r.author_id === profile?.id), [recipes, profile]);

    const totalSpent = useMemo(() => {
        return cartItems.reduce((acc, item) => acc + (item.price || 0) * item.amount, 0);
    }, [cartItems]);

    const cookingStreakData = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toISOString().split('T')[0];
            const count = plannedMeals[dateStr]?.length || 0;
            return { label: d.toLocaleDateString('en-US', { weekday: 'narrow' }), count };
        });
    }, [plannedMeals]);

    const streakCount = useMemo(() => {
        let count = 0;
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            if (plannedMeals[dateStr] && plannedMeals[dateStr].length > 0) {
                count++;
            } else if (i > 0) {
                break;
            }
        }
        return count;
    }, [plannedMeals]);

    const milestone = useMemo(() => {
        const count = myRecipes.length;
        if (count >= 10) return { label: 'Legendary Chef', level: 10, status: 'Master', progress: 100, color: 'bg-amber-500', icon: Star };
        if (count >= 5) return { label: 'Kitchen Master', level: 7, status: 'Expert', progress: 75, color: 'bg-emerald-500', icon: ChefHat };
        if (count >= 3) return { label: 'Family Favorite', level: 4, status: 'Pro', progress: 50, color: 'bg-blue-500', icon: Heart };
        if (count >= 1) return { label: 'Rising Star', level: 2, status: 'Rookie', progress: 25, color: 'bg-indigo-500', icon: Award };
        return { label: 'New Member', level: 1, status: 'Joined', progress: 5, color: 'bg-gray-400', icon: Users };
    }, [myRecipes]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setIsInviting(true);
        setTimeout(() => {
            alert(`Invitation sent to ${inviteEmail}! (Simulated)`);
            setInviteEmail('');
            setIsInviting(false);
            setShowInviteModal(false);
        }, 800);
    };

    if (loading || recipesLoading || favoritesLoading || plannerLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Crunching your numbers...</p>
                </div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 pt-16">
            {/* Header / Cover Section */}
            <div className="relative h-[25vh] md:h-[30vh] bg-primary-600 overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>

                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 md:left-24 md:translate-x-0">
                    <div className="relative group">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] bg-white p-2 shadow-2xl shadow-primary-200 flex items-center justify-center">
                            <div className="w-full h-full bg-primary-50 rounded-[2rem] flex items-center justify-center text-primary-600 font-black text-4xl">
                                {profile.username?.[0]?.toUpperCase() || 'N'}
                            </div>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm" title="Online" />
                    </div>
                </div>
            </div>

            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 mt-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-2">
                            {profile.username || 'Niroz Member'}
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-4 text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                            <span className="flex items-center gap-2">
                                <Award size={14} className="text-primary-600" />
                                {milestone.label}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                            <span>Joined {new Date(profile.updated_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-8 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Settings
                        </button>
                        {profile.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('users')}
                                className={`px-8 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <span className="flex items-center gap-2">
                                    <Users size={16} />
                                    Users
                                </span>
                            </button>
                        )}
                        {profile.role === 'admin' && (
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all shadow-xl shadow-gray-200"
                            >
                                <UserPlus size={18} />
                                Invite Member
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-red-500 font-bold text-sm hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Sub-stats Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                    {[
                        { label: 'Liked', value: myStats.likesGiven, icon: Heart, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-100', path: '/activity?type=likes' },
                        { label: 'Favorites', value: myStats.favoritesGiven, icon: Star, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-100', path: '/activity?type=favorites' },
                        { label: 'My Recipes', value: myStats.recipesCount, icon: ChefHat, color: 'from-orange-400 to-amber-600', shadow: 'shadow-orange-100', tab: 'my-recipes' },
                        { label: 'Likes Recv', value: myStats.likesReceived, icon: Award, color: 'from-yellow-400 to-amber-500', shadow: 'shadow-yellow-100', path: '/activity?type=likes' },
                        { label: 'Reviews', value: myStats.reviewsGiven, icon: MessageSquare, color: 'from-primary-500 to-indigo-600', shadow: 'shadow-primary-100', path: '/activity?type=reviews' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => {
                                if ('path' in stat) navigate(stat.path as string);
                                else if ('tab' in stat) setActiveTab(stat.tab as any);
                            }}
                            className={`relative bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group cursor-pointer`}
                        >
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-500`}>
                                    <stat.icon size={28} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-gray-900 leading-none mb-1">{stat.value}</div>
                                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none">{stat.label}</div>
                                </div>
                            </div>
                            <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500`}>
                                <stat.icon size={120} strokeWidth={3} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Tabs & Content */}
                <div className="space-y-8">
                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-3xl border border-gray-100 w-fit overflow-x-auto max-w-full">
                        {[
                            { id: 'favorites', label: 'Favorites', icon: Heart },
                            { id: 'my-recipes', label: 'My Recipes', icon: ChefHat },
                            { id: 'stats', label: 'Performance', icon: TrendingUp },
                            { id: 'settings', label: 'Settings', icon: Settings },
                            ...(profile?.role === 'admin' ? [{ id: 'users' as const, label: 'Manage Users', icon: Users }] : [])
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'favorites' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-6">
                                    {favoriteRecipes.length > 0 ? (
                                        favoriteRecipes.map(recipe => (
                                            <RecipeCard key={recipe.id} recipe={recipe} />
                                        ))
                                    ) : (
                                        <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-200">
                                            <Heart size={48} className="mx-auto text-gray-200 mb-4" />
                                            <h3 className="text-xl font-black text-gray-900 mb-2">No Favorites Yet</h3>
                                            <p className="text-gray-500 font-medium mb-8">Tap the heart on any recipe to save it here</p>
                                            <button
                                                onClick={() => navigate('/search')}
                                                className="px-8 py-3 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-100 hover:bg-primary-700 transition-colors"
                                            >
                                                Explore Recipes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'my-recipes' && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-6">
                                    {myRecipes.length > 0 ? (
                                        myRecipes.map(recipe => (
                                            <RecipeCard key={recipe.id} recipe={recipe} />
                                        ))
                                    ) : (
                                        <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-gray-200">
                                            <ChefHat size={48} className="mx-auto text-gray-200 mb-4" />
                                            <h3 className="text-xl font-black text-gray-900 mb-2">Build Your Cookbook</h3>
                                            <p className="text-gray-500 font-medium mb-8">Share your secret family recipes with everyone</p>
                                            <button
                                                onClick={() => navigate('/create')}
                                                className="px-8 py-3 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-100 hover:bg-primary-700 transition-colors"
                                            >
                                                Create Your First Recipe
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'stats' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
                                            <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-4">
                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                                    <Award size={24} />
                                                </div>
                                                Member Milestones
                                            </h3>
                                            <div className="flex items-center gap-6 mb-8">
                                                <div className={`w-20 h-20 rounded-[2rem] ${milestone.color} flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform duration-500 relative`}>
                                                    <milestone.icon size={40} strokeWidth={2.5} />
                                                    <div className="absolute -bottom-2 -right-2 bg-white text-gray-900 w-8 h-8 rounded-full flex items-center justify-center font-black border-4 border-gray-50 shadow-sm text-xs">
                                                        {milestone.level}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-gray-900 mb-1">{milestone.label}</h4>
                                                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{milestone.status}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <span className="font-bold text-gray-500 uppercase tracking-widest text-[10px]">Level Progress</span>
                                                        <span className="text-sm font-black text-primary-600">{milestone.progress}%</span>
                                                    </div>
                                                    <div className="h-4 w-full bg-gray-50 rounded-full overflow-hidden p-1 border border-gray-100">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${milestone.progress}%` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                            className={`h-full ${milestone.color} rounded-full relative`}
                                                        >
                                                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                        </motion.div>
                                                    </div>
                                                </div>

                                                <p className="text-sm text-gray-500 font-medium italic leading-relaxed">
                                                    {myRecipes.length === 0
                                                        ? "Start by adding your first recipe to level up!"
                                                        : `You've authored ${myRecipes.length} recipes. Share ${Math.max(0, (milestone.level * 2) - myRecipes.length)} more to reach the next level!`}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-gray-900 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
                                            <div className="relative z-10 h-full flex flex-col justify-between">
                                                <div>
                                                    <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
                                                        <TrendingUp className="text-primary-500" />
                                                        Cooking Streak
                                                    </h3>
                                                    <p className="text-gray-400 font-medium">
                                                        {streakCount > 0
                                                            ? `You've matched ${streakCount} days of planning!`
                                                            : "No meals planned this week yet."}
                                                    </p>
                                                </div>
                                                <div className="mt-8 flex items-end gap-2 h-32">
                                                    {cookingStreakData.map((d, i) => {
                                                        const maxCount = Math.max(...cookingStreakData.map(cd => cd.count)) || 1;
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                                                <motion.div
                                                                    initial={{ height: 0 }}
                                                                    animate={{ height: `${(d.count / maxCount) * 100}%` }}
                                                                    className={`w-full rounded-t-xl min-h-[4px] ${d.count > 0 ? 'bg-primary-500' : 'bg-white/10'}`}
                                                                />
                                                                <span className="text-[8px] font-bold text-gray-500">{d.label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary-600/20 blur-[60px] rounded-full" />
                                        </div>
                                    </div>

                                    {/* Extended Performance Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
                                            <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-4">
                                                <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                                                    <ChefHat size={24} />
                                                </div>
                                                Category Contribution
                                            </h3>
                                            <div className="space-y-4">
                                                {myRecipes.length === 0 ? (
                                                    <p className="text-gray-400 italic">No recipes contribution yet.</p>
                                                ) : (
                                                    Object.entries(
                                                        myRecipes.reduce((acc, r) => {
                                                            const catId = r.category_id || 0;
                                                            const catName = categories.find(c => c.id === catId)?.name || 'Misc';
                                                            acc[catName] = (acc[catName] || 0) + 1;
                                                            return acc;
                                                        }, {} as Record<string, number>)
                                                    ).map(([catName, count], i) => (
                                                        <div key={i} className="flex items-center gap-4">
                                                            <span className="text-sm font-bold text-gray-600 w-24 truncate">
                                                                {catName}
                                                            </span>
                                                            <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${(count / myRecipes.length) * 100}%` }}
                                                                    className="h-full bg-orange-500 rounded-full"
                                                                />
                                                            </div>
                                                            <span className="text-xs font-black text-gray-900">{count}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
                                            <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-4">
                                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                                    <DollarSign size={24} />
                                                </div>
                                                Spending Summary
                                            </h3>
                                            <div className="space-y-6">
                                                <div className="flex justify-between items-center p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                                    <div className="text-sm font-bold text-emerald-700">Total Spent to Date</div>
                                                    <div className="text-2xl font-black text-emerald-900">${totalSpent.toFixed(2)}</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Top Expense Items</div>
                                                    <div className="space-y-2">
                                                        {cartItems.slice(0, 3).map((item, i) => (
                                                            <div key={i} className="flex justify-between items-center text-sm">
                                                                <span className="text-gray-600 font-medium truncate pr-4">{item.name}</span>
                                                                <span className="text-gray-900 font-black">${(item.price || 0).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                        {cartItems.length === 0 && <p className="text-gray-400 italic text-sm">No items in cart</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'settings' && (
                                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 max-w-2xl">
                                    <h3 className="text-2xl font-black text-gray-900 mb-8">Profile Settings</h3>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Username</label>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all font-outfit"
                                                placeholder="Your chef name"
                                            />
                                        </div>
                                        <div className="pt-8">
                                            <button
                                                onClick={handleUpdateProfile}
                                                disabled={updating}
                                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-gray-200 disabled:opacity-50"
                                            >
                                                {updating ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                                Save Profile Changes
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-12 pt-12 border-t border-gray-100">
                                        <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                                <Settings size={20} />
                                            </div>
                                            Security
                                        </h3>
                                        <form onSubmit={handleChangePassword} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">New Password</label>
                                                    <input
                                                        type="password"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        className="w-full px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Confirm Password</label>
                                                    <input
                                                        type="password"
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        className="w-full px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={changingPassword || !newPassword}
                                                className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-100 disabled:opacity-50"
                                            >
                                                {changingPassword ? <Loader2 size={20} className="animate-spin" /> : null}
                                                Update Password
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'users' && profile.role === 'admin' && (
                                <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                                        <h3 className="text-2xl font-black text-gray-900">User Management</h3>
                                        <div className="text-sm font-bold text-gray-400">{allUsers.length} total members</div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gray-50/50 text-left">
                                                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">User</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Recipes</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Reviews</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Likes</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                                    <th className="px-8 py-4 text-right text-[10px] font-black uppercase tracking-widest text-gray-400">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {usersLoading ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-8 py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary-500" /></td>
                                                    </tr>
                                                ) : allUsers.map(user => (
                                                    <tr key={user.id} className="group hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-8 py-6">
                                                            <div>
                                                                <div className="font-bold text-gray-900">{user.username || 'Anonymous'}</div>
                                                                <div className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{user.id.slice(0, 8)}...</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-gray-600 font-bold">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1.5 bg-orange-50 rounded-lg">
                                                                    <ChefHat size={14} className="text-orange-500" />
                                                                </div>
                                                                {user.recipe_count}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-gray-600 font-bold">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1.5 bg-indigo-50 rounded-lg">
                                                                    <MessageSquare size={14} className="text-indigo-500" />
                                                                </div>
                                                                {user.review_count}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6 text-gray-600 font-bold">
                                                            <div className="flex items-center gap-2">
                                                                <div className="p-1.5 bg-rose-50 rounded-lg">
                                                                    <Heart size={14} className="text-rose-500" />
                                                                </div>
                                                                {user.likes_given}
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-6">
                                                            <button
                                                                onClick={() => toggleUserStatus(user.id, user.is_approved)}
                                                                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${user.is_approved
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                                            >
                                                                {user.is_approved ? 'Approved' : 'Pending'}
                                                            </button>
                                                        </td>
                                                        <td className="px-8 py-6 text-right">
                                                            <button
                                                                onClick={() => deleteUser(user.id)}
                                                                disabled={user.id === profile.id}
                                                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-0"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!usersLoading && allUsers.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic">No users found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

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
    );
}
