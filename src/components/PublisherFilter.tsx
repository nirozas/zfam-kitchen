import React, { useEffect, useState } from 'react';
import { useFollows } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { Users, Check, UserPlus, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface PublisherFilterProps {
    onFilterChange: (authorIds: string[] | null) => void;
}

export function PublisherFilter({ onFilterChange }: PublisherFilterProps) {
    const { follows, loading: followsLoading, toggleActive, toggleFollow, refreshFollows } = useFollows();
    const [publishers, setPublishers] = useState<any[]>([]);
    const [loadingPublishers, setLoadingPublishers] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [showDiscover, setShowDiscover] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setUserId(data.session.user.id);
            }
        });
    }, []);

    // Fetch all users who have published recipes
    useEffect(() => {
        async function fetchPublishers() {
            try {
                // Get unique author_ids from recipes
                const { data: recipesData, error: recipesError } = await supabase
                    .from('recipes')
                    .select('author_id')
                    .not('author_id', 'is', null);

                if (recipesError) throw recipesError;

                const counts: Record<string, number> = {};
                recipesData?.forEach(r => {
                    counts[r.author_id] = (counts[r.author_id] || 0) + 1;
                });
                
                const authorIds = Object.keys(counts);
                
                if (authorIds.length > 0) {
                    const { data: profiles, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, username')
                        .in('id', authorIds);

                    if (profilesError) throw profilesError;
                    
                    const formatted = profiles?.map(p => ({
                        ...p,
                        recipe_count: counts[p.id] || 0
                    })) || [];

                    // Exclude current user from the discover list
                    setPublishers(formatted.filter(p => p.id !== userId));
                }
            } catch (error) {
                console.error("Error fetching publishers:", error);
            } finally {
                setLoadingPublishers(false);
            }
        }
        
        if (userId) {
            fetchPublishers();
        } else {
            setLoadingPublishers(false);
        }
    }, [userId]);

    useEffect(() => {
        if (viewingUserId) {
            onFilterChange([viewingUserId]);
            return;
        }

        if (!userId) {
            onFilterChange(null);
            return;
        }

        const activeFollowIds = follows.filter(f => f.is_active).map(f => f.following_id);
        const filterIds = [userId, ...activeFollowIds];
        
        onFilterChange(filterIds);
    }, [follows, userId, viewingUserId, onFilterChange]);

    if (!userId) return null; // Must be logged in to see publisher filters

    return (
        <div className="w-full bg-white border border-gray-100 shadow-sm mb-6 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-500" />
                    <h3 className="font-semibold text-gray-900">Your Recipe Feed</h3>
                </div>
                <button 
                    onClick={() => setShowDiscover(!showDiscover)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                    <UserPlus className="w-4 h-4" />
                    {showDiscover ? "Hide Discover" : "Discover Publishers"}
                </button>
            </div>

            {viewingUserId && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-800 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Viewing recipes by <strong>{publishers.find(p => p.id === viewingUserId)?.username || 'Publisher'}</strong>
                    </span>
                    <button 
                        onClick={() => setViewingUserId(null)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded border border-indigo-200 hover:border-indigo-300 transition-colors"
                    >
                        Clear View
                    </button>
                </div>
            )}

            <div className="flex flex-wrap gap-2 mb-2">
                {followsLoading ? (
                    <div className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />
                ) : follows.length === 0 ? (
                    <p className="text-sm text-gray-500 py-1">You aren't following anyone yet. Discover publishers to add them to your feed!</p>
                ) : (
                    follows.map((follow) => (
                        <div key={follow.id} className="relative group flex items-center">
                            <button
                                onClick={() => toggleActive(follow.id, !follow.is_active)}
                                className={`flex items-center gap-2 pl-3 pr-8 py-1.5 rounded-full text-sm font-medium transition-all ${
                                    follow.is_active 
                                        ? "bg-primary-100 text-primary-700 border border-primary-200" 
                                        : "bg-gray-100 text-gray-500 border border-transparent hover:bg-gray-200"
                                }`}
                            >
                                {follow.is_active && <Check className="w-3 h-3" />}
                                {follow.following?.username || 'Unknown User'}
                            </button>
                            <button
                                onClick={() => {
                                    if(confirm('Are you sure you want to unfollow this publisher?')) {
                                        toggleFollow(follow.following_id);
                                    }
                                }}
                                className={`absolute right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                                    follow.is_active ? "text-primary-400 hover:text-red-500 hover:bg-red-50" : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                }`}
                                title="Unfollow"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Discover Section */}
            <AnimatePresence>
                {showDiscover && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4 pt-4 border-t border-gray-100"
                    >
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Discover Publishers</h4>
                        {loadingPublishers ? (
                            <div className="h-8 w-full bg-gray-50 animate-pulse rounded" />
                        ) : publishers.length === 0 ? (
                            <p className="text-sm text-gray-500">No other publishers found.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {publishers.map((publisher) => {
                                    const isFollowing = follows.some(f => f.following_id === publisher.id);
                                    return (
                                        <div key={publisher.id} className="border border-gray-100 rounded-lg p-3 flex flex-col items-center text-center bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg mb-2">
                                                {publisher.username?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 mb-1 truncate w-full">{publisher.username}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                                                {publisher.recipe_count} {publisher.recipe_count === 1 ? 'recipe' : 'recipes'}
                                            </span>
                                            <div className="flex gap-2 w-full mt-auto">
                                                <button
                                                    onClick={() => setViewingUserId(publisher.id)}
                                                    className="flex-1 py-1.5 px-2 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await toggleFollow(publisher.id);
                                                            toast.success(isFollowing ? "Unfollowed user" : "Followed user");
                                                        } catch (e) {
                                                            toast.error("Failed to update follow status");
                                                        }
                                                    }}
                                                    className={`flex-[1.5] py-1.5 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                                        isFollowing 
                                                            ? "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200" 
                                                            : "bg-primary-600 text-white hover:bg-primary-700"
                                                    }`}
                                                >
                                                    {isFollowing ? "Unfollow" : "Follow"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
