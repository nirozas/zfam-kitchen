import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Recipe } from './types';

export interface UseRecipesOptions {
    limit?: number;
    minimal?: boolean;
}

export function useRecipes(options?: UseRecipesOptions) {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchRecipes() {
            try {
                setLoading(true);

                let query;

                if (options?.minimal) {
                    query = supabase.from('recipes').select(`
                        id, slug, title, image_url, created_at, rating, category_id,
                        category:category_id(id, name, slug),
                        recipe_tags(tags(id, name))
                    `);
                } else {
                    query = supabase.from('recipes').select(`
                        *,
                        category:category_id(id, name, slug),
                        recipe_categories(categories(id, name, slug)),
                        recipe_tags(tags(id, name)),
                        recipe_ingredients!recipe_id(amount_in_grams, unit, group_name, order_index, note, ingredients(*), linked_recipe:recipes!linked_recipe_id(id, title, slug, image_url))
                    `);
                }

                query = query.order('created_at', { ascending: false });

                if (options?.limit) {
                    query = query.limit(options.limit);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase error:', error);
                    throw error;
                }

                const transformedRecipes: Recipe[] = (data || []).map((recipe: any) => ({
                    ...recipe,
                    rating: recipe.rating || 3,
                    category: recipe.category || { id: 0, name: 'Uncategorized', slug: 'uncategorized', image_url: null, created_at: null },
                    all_categories: recipe.recipe_categories?.map((rc: any) => rc.categories).filter(Boolean) || [],
                    tags: recipe.recipe_tags?.map((rt: any) => rt.tags).filter(Boolean) || [],
                    ingredients: options?.minimal ? [] : (recipe.recipe_ingredients || [])
                        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                        .map((ri: any) => ({
                            amount_in_grams: ri.amount_in_grams,
                            unit: ri.unit || 'g',
                            group_name: ri.group_name || 'Ingredients',
                            note: ri.note,
                            ingredient: ri.ingredients,
                            linked_recipe: ri.linked_recipe
                        })).filter((ing: any) => ing.ingredient || ing.linked_recipe) || [],
                    steps: recipe.steps || [],
                }));

                // Show recipes immediately — don't block on likes count
                setRecipes(transformedRecipes);
                setLoading(false);

                // Fetch likes in the background (non-blocking)
                if (transformedRecipes.length > 0) {
                    const recipeIds = transformedRecipes.map(r => r.id);
                    supabase
                        .from('likes')
                        .select('recipe_id')
                        .in('recipe_id', recipeIds)
                        .then(({ data: likesData }) => {
                            const likesCounts: Record<string, number> = {};
                            likesData?.forEach(like => {
                                likesCounts[like.recipe_id] = (likesCounts[like.recipe_id] || 0) + 1;
                            });
                            setRecipes(prev => prev.map(r => ({ ...r, likesCount: likesCounts[r.id] || 0 })));
                        });
                }
            } catch (err: any) {
                console.error('Full error:', err);
                const message = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
                setError(`Fetch Error: ${message}`);
            } finally {
                setLoading(false);
            }
        }

        fetchRecipes();
    }, [options?.limit]);

    return { recipes, loading, error };
}

export function useRecipe(id: string | undefined) {
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            setLoading(false);
            return;
        }

        async function fetchRecipe() {
            if (!id) return;
            try {
                setLoading(true);
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

                let query = supabase
                    .from('recipes')
                    .select(`
                        *,
                        category:category_id(id, name, slug),
                        recipe_categories(categories(id, name, slug)),
                        recipe_tags(tags(id, name)),
                        recipe_ingredients!recipe_id(amount_in_grams, unit, group_name, order_index, note, ingredients(*), linked_recipe:recipes!linked_recipe_id(id, title, slug, image_url))
                    `);

                if (isUuid) {
                    query = query.eq('id', id);
                } else {
                    query = query.eq('slug', id);
                }

                const { data, error } = await query.single();

                if (error) throw error;

                if (data) {
                    const transformedRecipe: Recipe = {
                        ...data,
                        rating: data.rating || 3,
                        category: data.category || { id: 0, name: 'Uncategorized', slug: 'uncategorized', image_url: null, created_at: null },
                        all_categories: data.recipe_categories?.map((rc: any) => rc.categories).filter(Boolean) || [],
                        tags: data.recipe_tags?.map((rt: any) => rt.tags).filter(Boolean) || [],
                        ingredients: data.recipe_ingredients
                            ?.sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                            .map((ri: any) => ({
                                amount_in_grams: ri.amount_in_grams,
                                unit: ri.unit || 'g',
                                group_name: ri.group_name || 'Main',
                                note: ri.note,
                                ingredient: ri.ingredients,
                                linked_recipe: ri.linked_recipe
                            })).filter((ing: any) => ing.ingredient || ing.linked_recipe) || [],
                    };

                    // Show the recipe immediately — don't wait for likes count
                    setRecipe(transformedRecipe);
                    setLoading(false);

                    // Fetch likes count in the background (non-blocking)
                    supabase
                        .from('likes')
                        .select('*', { count: 'exact', head: true })
                        .eq('recipe_id', transformedRecipe.id)
                        .then(({ count: likesCount }) => {
                            setRecipe(prev => prev ? { ...prev, likesCount: likesCount || 0 } : prev);
                        });
                }
            } catch (err: any) {
                console.error('Full Recipe Fetch Error:', err);
                const message = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
                setError(`Fetch Error: ${message}`);
            } finally {
                setLoading(false);
            }
        }

        fetchRecipe();
    }, [id]);

    return { recipe, loading, error };
}

export function useCategories() {
    const [categories, setCategories] = useState<Array<{ id: number; name: string; slug: string; image_url: string | null; order_index: number; parent_id: number | null; created_at: string | null }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            let { data, error: fetchError } = await supabase
                .from('categories')
                .select('*');

            if (fetchError) throw fetchError;

            // Sort in memory if order_index is present, else by name
            const sortedData = (data || []).sort((a: any, b: any) => {
                if ('order_index' in a && 'order_index' in b && a.order_index !== null && b.order_index !== null) {
                    return a.order_index - b.order_index;
                }
                return (a.name || '').localeCompare(b.name || '');
            });

            setCategories(sortedData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    return { categories, loading, error, refreshCategories: fetchCategories };
}

export function useRecipeStats() {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                // Count occurrences of each recipe_id in meal_planner
                const { data, error } = await supabase
                    .from('meal_planner')
                    .select('recipe_id');

                if (error) throw error;

                const counts: Record<string, number> = {};
                data?.forEach((row: any) => {
                    if (row.recipe_id) {
                        counts[row.recipe_id] = (counts[row.recipe_id] || 0) + 1;
                    }
                });
                setStats(counts);
            } catch (err) {
                console.error('Error fetching recipe stats:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    return { stats, loading };
}

export function useDetailedRecipeStats(recipeId: string | undefined) {
    const [stats, setStats] = useState({ month: 0, year: 0, allTime: 0 });
    const [loading, setLoading] = useState(false); // Start non-blocking

    useEffect(() => {
        if (!recipeId) return;
        async function fetchStats() {
            try {
                setLoading(true);
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

                const [allTimeRes, monthRes, yearRes] = await Promise.all([
                    supabase.from('meal_planner').select('*', { count: 'exact', head: true }).eq('recipe_id', recipeId),
                    supabase.from('meal_planner').select('*', { count: 'exact', head: true }).eq('recipe_id', recipeId).gte('date', monthStart),
                    supabase.from('meal_planner').select('*', { count: 'exact', head: true }).eq('recipe_id', recipeId).gte('date', yearStart)
                ]);

                setStats({
                    allTime: allTimeRes.count || 0,
                    month: monthRes.count || 0,
                    year: yearRes.count || 0
                });
            } catch (err) {
                console.error('Error fetching detailed stats:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [recipeId]);

    return { stats, loading };
}

export function useTopTags(limit: number = 12) {
    const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTopTags() {
            try {
                const { data, error } = await supabase
                    .from('recipe_tags')
                    .select('tags(name)');

                if (error) throw error;

                const counts: Record<string, number> = {};
                data?.forEach((rt: any) => {
                    const tagName = rt.tags?.name;
                    if (tagName) {
                        counts[tagName] = (counts[tagName] || 0) + 1;
                    }
                });

                const sortedTags = Object.entries(counts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, limit);

                setTags(sortedTags);
            } catch (err) {
                console.error('Error fetching top tags:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchTopTags();
    }, [limit]);

    return { tags, loading };
}

export function useFavorites() {
    const [favorites, setFavorites] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFavorites();
    }, []);

    async function fetchFavorites() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setFavorites([]);
                return;
            }

            const { data, error } = await supabase
                .from('favorites')
                .select('recipe_id')
                .eq('user_id', user.id);

            if (error) throw error;
            setFavorites(data?.map(f => f.recipe_id) || []);
        } catch (err) {
            console.error('Error fetching favorites:', err);
        } finally {
            setLoading(false);
        }
    }

    const toggleFavorite = async (recipeId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('Please sign in to favorite recipes');
                return;
            }

            const isFavorited = favorites.includes(recipeId);

            if (isFavorited) {
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('recipe_id', recipeId);

                if (error) throw error;
                setFavorites(favorites.filter(id => id !== recipeId));
            } else {
                const { error } = await supabase
                    .from('favorites')
                    .insert({ user_id: user.id, recipe_id: recipeId });

                if (error) throw error;
                setFavorites([...favorites, recipeId]);
            }
        } catch (err) {
            console.error('Error toggling favorite:', err);
        }
    };

    return { favorites, toggleFavorite, loading };
}

export function useReviews(recipeId: string | undefined) {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReviews = async () => {
        if (!recipeId) return;
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select(`
                    *,
                    profiles:user_id(username)
                `)
                .eq('recipe_id', recipeId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReviews(data || []);
        } catch (err) {
            console.error('Error fetching reviews:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [recipeId]);

    return { reviews, loading, fetchReviews };
}

export function useLikesCount(recipeId: string | undefined) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!recipeId) return;
        async function fetchLikes() {
            try {
                const { count, error } = await supabase
                    .from('favorites')
                    .select('*', { count: 'exact', head: true })
                    .eq('recipe_id', recipeId);

                if (error) throw error;
                setCount(count || 0);
            } catch (err) {
                console.error('Error fetching likes count:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchLikes();
    }, [recipeId]);

    return { count, loading };
}

export function useUserStats(userId: string | undefined) {
    const [stats, setStats] = useState({
        likesReceived: 0,
        likesGiven: 0,
        favoritesGiven: 0,
        reviewsGiven: 0,
        recipesCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        async function fetchUserStats() {
            try {
                // 1. Recipes Count
                const { count: recipesCount } = await supabase
                    .from('recipes')
                    .select('*', { count: 'exact', head: true })
                    .eq('author_id', userId);

                // 2. Favorites Given (Bookmarks)
                const { count: favoritesGiven } = await supabase
                    .from('favorites')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                // 2b. Likes Given (Social)
                const { count: likesGiven } = await supabase
                    .from('likes')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                // 3. Reviews Given
                const { count: reviewsGiven } = await supabase
                    .from('reviews')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId);

                // 4. Likes Received (Total favorites on user's recipes)
                const { data: userRecipes } = await supabase
                    .from('recipes')
                    .select('id')
                    .eq('author_id', userId);

                const recipeIds = userRecipes?.map(r => r.id) || [];
                let likesReceived = 0;
                if (recipeIds.length > 0) {
                    const { count: receivedCount } = await supabase
                        .from('favorites')
                        .select('*', { count: 'exact', head: true })
                        .in('recipe_id', recipeIds);
                    likesReceived = receivedCount || 0;
                }

                setStats({
                    recipesCount: recipesCount || 0,
                    likesGiven: likesGiven || 0,
                    favoritesGiven: favoritesGiven || 0,
                    reviewsGiven: reviewsGiven || 0,
                    likesReceived
                });
            } catch (err) {
                console.error('Error fetching user stats:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchUserStats();
    }, [userId]);

    return { stats, loading };
}

// --- Likes Hook ---
export function useLikes() {
    const [likes, setLikes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLikes = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLikes([]);
                return;
            }

            const { data, error } = await supabase
                .from('likes')
                .select('recipe_id')
                .eq('user_id', user.id);

            if (error) throw error;
            setLikes(data?.map(l => l.recipe_id) || []);
        } catch (err) {
            console.error('Error fetching likes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLikes();
    }, []);

    const toggleLike = async (recipeId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (likes.includes(recipeId)) {
                const { error } = await supabase
                    .from('likes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('recipe_id', recipeId);
                if (error) throw error;
                setLikes(prev => prev.filter(id => id !== recipeId));
            } else {
                const { error } = await supabase
                    .from('likes')
                    .insert([{ user_id: user.id, recipe_id: recipeId }]);
                if (error) throw error;
                setLikes(prev => [...prev, recipeId]);
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    };

    return { likes, loading, toggleLike, fetchLikes };
}

export function useRecipeLikes(recipeId?: string) {
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchCount = async () => {
        if (!recipeId) return;
        try {
            const { count: likesCount, error } = await supabase
                .from('likes')
                .select('*', { count: 'exact', head: true })
                .eq('recipe_id', recipeId);

            if (error) throw error;
            setCount(likesCount || 0);
        } catch (err) {
            console.error('Error fetching recipe likes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCount();
    }, [recipeId]);

    return { count, loading, fetchCount };
}

export function useBatchedRecipeLikes(recipeIds: string[]) {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchCounts = async () => {
        if (!recipeIds || recipeIds.length === 0) {
            setCounts({});
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('likes')
                .select('recipe_id')
                .in('recipe_id', recipeIds);

            if (error) throw error;

            const newCounts: Record<string, number> = {};
            data?.forEach((like) => {
                newCounts[like.recipe_id] = (newCounts[like.recipe_id] || 0) + 1;
            });

            setCounts(newCounts);
        } catch (err) {
            console.error('Error fetching batched likes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCounts();
    }, [JSON.stringify(recipeIds)]); // depend on stringified array

    return { counts, loading, fetchCounts };
}
