import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowLeft, Loader2, ChefHat, Star, Heart } from 'lucide-react';
import RecipeCard from '@/components/RecipeCard';
import { Recipe } from '@/lib/types';

export default function Activity() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const rawType = searchParams.get('type');
    const type = (rawType === 'reviews' || rawType === 'favorites') ? rawType : 'likes';

    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActivity();
    }, [type]);

    const fetchActivity = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/auth');
                return;
            }

            const selectQuery = `
                recipe:recipes(
                    *,
                    category:categories(*),
                    author:profiles(*),
                    tags:tags(*),
                    ingredients:recipe_ingredients!recipe_id(
                        amount_in_grams,
                        unit,
                        ingredient:ingredients(*)
                    )
                )
            `;

            if (type === 'likes') {
                const { data, error } = await supabase
                    .from('likes')
                    .select(selectQuery)
                    .eq('user_id', user.id);

                if (error) throw error;
                const likedRecipes = (data as any[] | null)?.map(item => item.recipe).filter(Boolean) || [];
                setRecipes(likedRecipes);
            } else if (type === 'favorites') {
                const { data, error } = await supabase
                    .from('favorites')
                    .select(selectQuery)
                    .eq('user_id', user.id);

                if (error) throw error;
                const favoriteRecipes = (data as any[] | null)?.map(item => item.recipe).filter(Boolean) || [];
                setRecipes(favoriteRecipes);
            } else {
                const { data, error } = await supabase
                    .from('reviews')
                    .select(selectQuery)
                    .eq('user_id', user.id);

                if (error) throw error;
                const reviewedRecipes = (data as any[] | null)?.map(item => item.recipe).filter(Boolean) || [];
                const uniqueRecipes = Array.from(new Map(reviewedRecipes.map((r: any) => [r.id, r])).values());
                setRecipes(uniqueRecipes as Recipe[]);
            }
        } catch (err) {
            console.error('Error fetching activity:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 pt-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-12">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold mb-6 transition-colors group text-sm uppercase tracking-widest"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Profile
                    </button>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
                                <div className={`p-3 rounded-2xl shadow-lg ${type === 'likes' ? 'bg-rose-500 text-white shadow-rose-200' :
                                    type === 'favorites' ? 'bg-amber-500 text-white shadow-amber-200' :
                                        'bg-orange-500 text-white shadow-orange-200'
                                    }`}>
                                    {type === 'likes' ? <Heart size={32} /> :
                                        type === 'favorites' ? <Star size={32} fill="currentColor" /> :
                                            <MessageSquare size={32} />}
                                </div>
                                {type === 'likes' ? 'My Likes' : type === 'favorites' ? 'My Favorites' : 'My Reviews'}
                            </h1>
                            <p className="text-gray-500 font-medium mt-2">
                                {type === 'likes' ? "Recipes you've given a heart to." :
                                    type === 'favorites' ? "Recipes you've favorited for later."
                                        : "Recipes you've shared your thoughts on."}
                            </p>
                        </div>

                        <div className="flex p-1 bg-white border border-gray-100 rounded-2xl shadow-sm">
                            <button
                                onClick={() => setSearchParams({ type: 'likes' })}
                                className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-widest ${type === 'likes' ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Likes
                            </button>
                            <button
                                onClick={() => setSearchParams({ type: 'favorites' })}
                                className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-widest ${type === 'favorites' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Favorites
                            </button>
                            <button
                                onClick={() => setSearchParams({ type: 'reviews' })}
                                className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-widest ${type === 'reviews' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                Reviews
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-12 h-12 animate-spin text-primary-600 mb-4" />
                        <p className="text-gray-500 font-medium italic">Finding your recipes...</p>
                    </div>
                ) : recipes.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-6">
                        {recipes.map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100 shadow-sm">
                        <ChefHat size={64} className="mx-auto text-gray-200 mb-6" />
                        <h3 className="text-2xl font-black text-gray-900 mb-2">No activity found</h3>
                        <p className="text-gray-500 font-medium mb-8">
                            {type === 'favorites' ? "You haven't favorited any recipes yet."
                                : "You haven't written any reviews yet. Share your feedback!"}
                        </p>
                        <button
                            onClick={() => navigate('/search')}
                            className="px-8 py-4 bg-primary-600 text-white rounded-2xl font-black hover:bg-primary-700 transition-all shadow-xl shadow-primary-100"
                        >
                            Find Recipes to {type === 'likes' ? 'Like' : type === 'favorites' ? 'Favorite' : 'Review'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
