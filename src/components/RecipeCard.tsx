import { Recipe } from '@/lib/types';
import { Clock, Flame, Star, ShoppingCart, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useShoppingCart, getCurrentWeekId } from '@/contexts/ShoppingCartContext';
import { useFavorites, useLikes } from '@/lib/hooks';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

interface RecipeCardProps {
    recipe: Recipe;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
    const { cartItems, addToCart } = useShoppingCart();
    const { favorites, toggleFavorite } = useFavorites();
    const { likes, toggleLike } = useLikes();
    const [localLikesCount, setLocalLikesCount] = useState(recipe.likesCount || 0);

    // Sync if parent updates the pre-fetched likesCount
    useEffect(() => {
        if (recipe.likesCount !== undefined) {
            setLocalLikesCount(recipe.likesCount);
        }
    }, [recipe.likesCount]);

    // Check if any items from this recipe are in the cart
    const isInCart = cartItems.some(item => item.recipeIds.includes(recipe.id));

    const isFavorited = favorites.includes(recipe.id);
    const isLiked = likes.includes(recipe.id);

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(recipe.id);
    };

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Optimistic UI
        setLocalLikesCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);

        await toggleLike(recipe.id);
    };

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const currentWeekId = getCurrentWeekId();
        recipe.ingredients.forEach((item) => {
            addToCart({
                name: item.ingredient.name,
                amount: item.amount_in_grams,
                unit: item.unit || 'g',
                recipeId: recipe.id,
                recipeName: recipe.title,
                weekId: currentWeekId,
            });
        });
        toast.success(`Success! Items for "${recipe.title}" added to cart.`, {
            icon: '🛒',
            style: {
                borderRadius: '12px',
                background: '#333',
                color: '#fff',
            },
        });
    };

    return (
        <motion.div
            variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="group bg-white rounded-3xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_40px_-12px_rgba(233,84,84,0.2)] transition-all duration-500 border border-gray-100 relative"
        >
            <Link to={`/recipe/${recipe.slug || recipe.id}`} className="block">
                <div className="aspect-[3/2] overflow-hidden relative bg-gray-100 flex items-center justify-center">
                    {recipe.image_url ? (
                        <img
                            src={recipe.image_url}
                            alt={recipe.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                    ) : (
                        <span className="text-4xl text-gray-300">🍽️</span>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="absolute top-4 left-4 z-10">
                        <span className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-primary-600 shadow-sm border border-white">
                            {recipe.category?.name || 'Recipe'}
                        </span>
                    </div>

                    {/* Action Buttons - Always visible on mobile, hover on desktop */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 lg:translate-x-4 lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 transition-all duration-500">
                        <button
                            onClick={handleToggleLike}
                            className={`p-2 rounded-full backdrop-blur-xl transition-all duration-300 shadow-xl border ${isLiked
                                ? 'bg-rose-500 text-white border-rose-400'
                                : 'bg-white/90 text-gray-600 border-white hover:bg-white hover:text-rose-500'
                                }`}
                            title={isLiked ? "Unlike" : "Like"}
                        >
                            <Heart size={16} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "animate-pulse" : ""} />
                        </button>
                        <button
                            onClick={handleToggleFavorite}
                            className={`p-2 rounded-full backdrop-blur-xl transition-all duration-300 shadow-xl border ${isFavorited
                                ? 'bg-amber-500 text-white border-amber-400'
                                : 'bg-white/90 text-gray-600 border-white hover:bg-white hover:text-amber-500'
                                }`}
                            title={isFavorited ? "Remove from favorites" : "Favorite this recipe"}
                        >
                            <Star size={16} fill={isFavorited ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={handleAddToCart}
                            className={`p-2 rounded-full backdrop-blur-xl transition-all duration-300 shadow-xl border ${isInCart
                                ? 'bg-green-500 text-white border-green-400'
                                : 'bg-white/90 text-gray-600 border-white hover:bg-white hover:text-primary-600'
                                }`}
                            title={isInCart ? "Already in cart" : "Add all ingredients to cart"}
                        >
                            <ShoppingCart size={16} />
                        </button>
                    </div>
                </div>

                <div className="p-2 sm:p-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-yellow-500">
                                <Star size={12} fill="currentColor" />
                                <span className="text-xs font-bold text-gray-700">{recipe.rating || 0}</span>
                            </div>
                            <div className="w-px h-3 bg-gray-200" />
                            <div className="flex items-center gap-1 text-rose-500">
                                <Heart size={12} fill="currentColor" />
                                <span className="text-xs font-bold text-gray-700">{localLikesCount}</span>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[80px]">
                            by {recipe.author?.username || 'Chef'}
                        </div>
                    </div>

                    <h3 className="font-extrabold text-[11px] sm:text-xs md:text-sm text-gray-900 mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors min-h-[1.5rem] sm:min-h-[2.5rem] leading-tight flex items-center">
                        {recipe.title}
                    </h3>

                    <p className="hidden sm:line-clamp-2 text-gray-500 text-[11px] mb-3 h-8">
                        {recipe.description}
                    </p>

                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-medium text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                            <Clock size={12} className="text-primary-500" />
                            <span>{recipe.time_minutes || 30}m</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Flame size={12} className="text-orange-500" />
                            <span>{Math.round(recipe.ingredients.reduce((acc, curr) => acc + (curr.amount_in_grams * (curr.ingredient.calories_per_100g || 0) / 100), 0))} kcal</span>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
