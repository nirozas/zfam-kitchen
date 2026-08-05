import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface UserInteractionsContextType {
    favorites: string[];
    likes: string[];
    loading: boolean;
    toggleFavorite: (recipeId: string) => Promise<void>;
    toggleLike: (recipeId: string) => Promise<void>;
    refreshInteractions: () => Promise<void>;
}

const UserInteractionsContext = createContext<UserInteractionsContextType | undefined>(undefined);

export function UserInteractionsProvider({ children }: { children: React.ReactNode }) {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [likes, setLikes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    // Initial auth check and listener setup
    useEffect(() => {
        let mounted = true;
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                setUserId(session?.user?.id || null);
                if (!session?.user) setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setUserId(session?.user?.id || null);
                if (!session?.user) {
                    setFavorites([]);
                    setLikes([]);
                    setLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchInteractions = async (currentUserId: string) => {
        setLoading(true);
        try {
            const [favRes, likeRes] = await Promise.all([
                supabase.from('favorites').select('recipe_id').eq('user_id', currentUserId),
                supabase.from('likes').select('recipe_id').eq('user_id', currentUserId)
            ]);

            if (favRes.error) throw favRes.error;
            if (likeRes.error) throw likeRes.error;

            setFavorites(favRes.data?.map(f => f.recipe_id) || []);
            setLikes(likeRes.data?.map(l => l.recipe_id) || []);
        } catch (err) {
            console.error('Error fetching user interactions:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when userId changes
    useEffect(() => {
        if (!userId) return;
        fetchInteractions(userId);
    }, [userId]);

    const toggleFavorite = async (recipeId: string) => {
        if (!userId) {
            toast.error('Please sign in to favorite recipes');
            return;
        }

        const isFavorited = favorites.includes(recipeId);

        // Optimistic UI update
        setFavorites(prev => 
            isFavorited ? prev.filter(id => id !== recipeId) : [...prev, recipeId]
        );

        try {
            if (isFavorited) {
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('recipe_id', recipeId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('favorites')
                    .insert({ user_id: userId, recipe_id: recipeId });
                if (error) throw error;
            }
        } catch (err) {
            console.error('Error toggling favorite:', err);
            // Revert optimistic update
            setFavorites(prev => 
                isFavorited ? [...prev, recipeId] : prev.filter(id => id !== recipeId)
            );
            toast.error('Failed to update favorite status');
        }
    };

    const toggleLike = async (recipeId: string) => {
        if (!userId) {
            toast.error('Please sign in to like recipes');
            return;
        }

        const isLiked = likes.includes(recipeId);

        // Optimistic UI update
        setLikes(prev => 
            isLiked ? prev.filter(id => id !== recipeId) : [...prev, recipeId]
        );

        try {
            if (isLiked) {
                const { error } = await supabase
                    .from('likes')
                    .delete()
                    .eq('user_id', userId)
                    .eq('recipe_id', recipeId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('likes')
                    .insert({ user_id: userId, recipe_id: recipeId });
                if (error) throw error;
            }
        } catch (err) {
            console.error('Error toggling like:', err);
            // Revert optimistic update
            setLikes(prev => 
                isLiked ? [...prev, recipeId] : prev.filter(id => id !== recipeId)
            );
            toast.error('Failed to update like status');
        }
    };

    const refreshInteractions = async () => {
        if (userId) {
            await fetchInteractions(userId);
        }
    };

    return (
        <UserInteractionsContext.Provider value={{ favorites, likes, loading, toggleFavorite, toggleLike, refreshInteractions }}>
            {children}
        </UserInteractionsContext.Provider>
    );
}

export function useUserInteractions() {
    const context = useContext(UserInteractionsContext);
    if (context === undefined) {
        throw new Error('useUserInteractions must be used within a UserInteractionsProvider');
    }
    return context;
}
