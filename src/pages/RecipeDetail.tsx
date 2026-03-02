import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Minus, Plus, Clock, Flame, ArrowLeft, ShoppingCart, Star, ExternalLink, Play, Trash2, Pencil, Loader2, Check, X, Maximize2, AlertTriangle, Printer, Share2, MessageSquare, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShoppingCart, getCurrentWeekId } from '@/contexts/ShoppingCartContext';
import { useRecipe, useFavorites, useReviews, useLikes, useRecipeLikes, useDetailedRecipeStats } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';

export default function RecipeDetail() {
    const { id } = useParams();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    const navigate = useNavigate();
    const { recipe, loading } = useRecipe(id);
    const { reviews, fetchReviews } = useReviews(isUuid ? id : recipe?.id);
    const { likes, toggleLike } = useLikes();
    const { count: likesCount, fetchCount: fetchLikesCount } = useRecipeLikes(recipe?.id);
    const { stats: usageStats } = useDetailedRecipeStats(recipe?.id);
    const [multiplier, setMultiplier] = useState(1);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // UI State
    const [crossedIngredients, setCrossedIngredients] = useState<number[]>([]);
    const [crossedSteps, setCrossedSteps] = useState<number[]>([]);
    const [selectedForCart, setSelectedForCart] = useState<number[]>([]);
    const [userRating, setUserRating] = useState<number | null>(0);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const { addToCart } = useShoppingCart();
    const { favorites, toggleFavorite } = useFavorites();
    const [addingToCart, setAddingToCart] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Media State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        // User requested that ingredients start UNCHECKED and multiplier defaults to 1
        setSelectedForCart([]);
        setMultiplier(1);
    }, [recipe]);

    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                setIsAdmin(profile?.role === 'admin');
            }
        };
        checkUser();
    }, []);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipe || !currentUserId || userRating === 0) return;
        setSubmittingReview(true);
        try {
            const { error } = await supabase
                .from('reviews')
                .upsert({
                    user_id: currentUserId,
                    recipe_id: recipe!.id,
                    rating: userRating,
                    comment: reviewComment
                }, { onConflict: 'user_id,recipe_id' });

            if (error) throw error;

            // Also update the average rating in recipes table for performance/sorting
            const { data: allReviews } = await supabase
                .from('reviews')
                .select('rating')
                .eq('recipe_id', recipe!.id);

            if (allReviews && allReviews.length > 0) {
                const avg = allReviews.reduce((acc, r) => acc + (r.rating || 0), 0) / allReviews.length;
                await supabase
                    .from('recipes')
                    .update({ rating: Math.round(avg * 10) / 10 })
                    .eq('id', recipe!.id);
            }

            setReviewComment('');
            fetchReviews();
            alert('Review submitted! Thank you.');
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Failed to submit review.');
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleDelete = async () => {
        if (!recipe) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', recipe!.id);

            if (error) throw error;
            navigate('/');
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('Failed to delete recipe');
            setIsDeleting(false);
        }
    };

    const handleAddSelectedToCart = async () => {
        if (!recipe || selectedForCart.length === 0) return;
        setAddingToCart(true);
        const currentWeekId = getCurrentWeekId();

        try {
            for (const index of selectedForCart) {
                const item = recipe.ingredients[index];
                await addToCart({
                    name: item.ingredient.name,
                    amount: Math.round(item.amount_in_grams * multiplier),
                    unit: item.unit || 'g',
                    recipeId: recipe.id,
                    recipeName: recipe.title,
                    weekId: currentWeekId,
                });
            }
            alert(`${selectedForCart.length} items added to cart!`);
            setSelectedForCart([]); // Clear selection after adding
        } finally {
            setAddingToCart(false);
        }
    };

    const toggleCrossed = (index: number) => {
        if (crossedIngredients.includes(index)) {
            setCrossedIngredients(crossedIngredients.filter(i => i !== index));
        } else {
            setCrossedIngredients([...crossedIngredients, index]);
        }
    };

    const toggleStepCrossed = (index: number) => {
        if (crossedSteps.includes(index)) {
            setCrossedSteps(crossedSteps.filter(i => i !== index));
        } else {
            setCrossedSteps([...crossedSteps, index]);
        }
    };

    const toggleSelectedForCart = (index: number) => {
        if (selectedForCart.includes(index)) {
            setSelectedForCart(selectedForCart.filter(i => i !== index));
        } else {
            setSelectedForCart([...selectedForCart, index]);
        }
    };

    const getVideoData = (url: string) => {
        if (!url || typeof url !== 'string') return null;
        const trimmedUrl = url.trim();
        if (!trimmedUrl) return null;

        try {
            // 1. YouTube
            const ytMatch = trimmedUrl.match(/(?:youtu\.be\/|youtube\.com\/|youtube-nocookie\.com\/)(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.*?v=)?([\w-]{11})/);
            if (ytMatch) return { type: 'embed', url: `https://www.youtube.com/embed/${ytMatch[1]}` };

            // 2. Vimeo
            const vimeoMatch = trimmedUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/);
            if (vimeoMatch) return { type: 'embed', url: `https://player.vimeo.com/video/${vimeoMatch[1]}` };

            // 3. Instagram
            const igMatch = trimmedUrl.match(/instagram\.com\/(?:p|reels|reel)\/([^/?#&]+)/);
            if (igMatch) return { type: 'embed', url: `https://www.instagram.com/p/${igMatch[1]}/embed` };

            // 4. TikTok
            const ttMatch = trimmedUrl.match(/tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|t\/)(\d+)/);
            if (ttMatch) return { type: 'embed', url: `https://www.tiktok.com/embed/v2/${ttMatch[1]}` };

            // 5. Google Drive
            const gdMatch = trimmedUrl.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
            if (gdMatch) return { type: 'embed', url: `https://drive.google.com/file/d/${gdMatch[1]}/preview` };

            // 6. Box
            const boxMatch = trimmedUrl.match(/app\.box\.com\/s\/([\w-]+)/);
            if (boxMatch) return { type: 'embed', url: `https://app.box.com/embed/s/${boxMatch[1]}` };

            // 7. Dropbox
            const dbMatch = trimmedUrl.match(/dropbox\.com\/(?:scl\/fi\/|s\/)([\w.-]+)/);
            if (dbMatch) {
                let rawUrl = trimmedUrl;
                if (rawUrl.includes('dl=0')) {
                    rawUrl = rawUrl.replace('dl=0', 'raw=1');
                } else if (!rawUrl.includes('raw=1') && !rawUrl.includes('dl=1')) {
                    rawUrl += (rawUrl.includes('?') ? '&' : '?') + 'raw=1';
                }
                return { type: 'direct', url: rawUrl };
            }

            // 8. Direct Video Files
            if (trimmedUrl.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i)) {
                return { type: 'direct', url: trimmedUrl };
            }

            if (trimmedUrl.includes('embed')) return { type: 'embed', url: trimmedUrl };
        } catch (e) {
            console.error('Error parsing video URL:', e);
        }

        return null;
    };

    const videoData = recipe?.video_url ? getVideoData(recipe.video_url) : null;

    const baseCalories = recipe?.ingredients?.reduce((acc, curr) => {
        return acc + (curr.amount_in_grams * (curr.ingredient.calories_per_100g || 0) / 100);
    }, 0) || 0;

    const isOwner = currentUserId && recipe?.author_id === currentUserId;


    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: recipe?.title || 'Recipe',
                    text: `Check out this recipe for ${recipe?.title}!`,
                    url: window.location.href,
                });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                alert('Link copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Preparing your recipe...</p>
                </div>
            </div>
        );
    }

    if (!recipe) {
        return <div className="py-20 text-center text-xl font-bold text-gray-500">Recipe not found</div>;
    }

    return (
        <div className="bg-white min-h-screen pb-20">
            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowDeleteConfirm(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-[2rem] p-8 w-full max-w-md relative z-10 shadow-2xl border border-gray-100"
                        >
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-2xl font-black text-center text-gray-900 mb-2">Delete Recipe?</h3>
                            <p className="text-center text-gray-500 mb-8 font-medium">
                                Are you sure you want to delete <span className="text-gray-900 font-bold">"{recipe.title}"</span>? This action cannot be undone.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-3 px-6 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 px-6 rounded-xl bg-red-500 font-bold text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 className="animate-spin w-5 h-5" /> : <Trash2 size={20} />}
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Media Lightbox */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
                        onClick={() => setSelectedImage(null)}
                    >
                        <button
                            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            onClick={() => setSelectedImage(null)}
                        >
                            <X size={24} />
                        </button>
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={selectedImage}
                            alt="Full view"
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hero Section */}
            <div className="relative h-[50vh] md:h-[65vh] w-full overflow-hidden">
                {recipe.image_url ? (
                    <img
                        src={recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover cursor-zoom-in transition-transform duration-700 hover:scale-105"
                        onClick={() => setSelectedImage(recipe.image_url || null)}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <span className="text-6xl">🍽️</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-10">
                    <Link to="/" className="absolute top-6 left-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors z-30">
                        <ArrowLeft size={24} />
                    </Link>

                    <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-30">
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-2">
                                <Link
                                    to={`/category/${recipe.category?.slug || 'uncategorized'}`}
                                    className="px-4 py-1.5 bg-primary-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-primary-600 transition-colors shadow-lg shadow-black/20"
                                >
                                    {recipe.category?.name || 'Uncategorized'}
                                </Link>
                            </div>

                            {(isOwner || isAdmin) && (
                                <div className="flex gap-2 print:hidden relative z-[40]">
                                    <Link
                                        to={`/edit/${recipe ? recipe.id : ''}`}
                                        className="bg-white/30 backdrop-blur-md p-3.5 rounded-2xl hover:bg-white/40 transition-all text-white border border-white/20 shadow-xl active:scale-90 flex items-center justify-center"
                                        title="Edit Recipe"
                                    >
                                        <Pencil size={24} strokeWidth={2.5} />
                                    </Link>
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="bg-red-500/40 backdrop-blur-md p-3.5 rounded-2xl hover:bg-red-500/60 transition-all text-white border border-white/20 shadow-xl active:scale-90 flex items-center justify-center"
                                        title="Delete Recipe"
                                    >
                                        <Trash2 size={24} strokeWidth={2.5} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Square Cover Box */}
                        {recipe.image_url && (
                            <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-[2.5rem] overflow-hidden border-2 border-white/30 shadow-2xl shadow-black/80 transition-all duration-500 hover:scale-[1.03] cursor-zoom-in group" onClick={() => setSelectedImage(recipe.image_url || null)}>
                                <img src={recipe.image_url} alt="Cover" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Maximize2 className="text-white" size={24} />
                                </div>
                            </div>
                        )}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-4xl relative z-10 pt-44 sm:pt-56 md:pt-64 lg:pt-40"
                    >
                        <div className="flex flex-wrap items-center gap-4 mb-4 sm:hidden">
                            <Link
                                to={`/category/${recipe.category?.slug || 'uncategorized'}`}
                                className="px-3 py-1 bg-primary-500 text-white text-[9px] font-black uppercase tracking-[0.1em] rounded-full shadow-lg"
                            >
                                {recipe.category?.name || 'Uncategorized'}
                            </Link>
                        </div>

                        <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-2 shadow-sm tracking-tight sm:tracking-tighter leading-[1.1] sm:leading-[0.9]">
                            {recipe.title}
                        </h1>

                        {/* Alternative Titles */}
                        {recipe.alternative_titles && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {recipe.alternative_titles.split(',').map((alt, i) => (
                                    <span key={i} className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-2xl text-white/60 text-[20px] font-black uppercase tracking-widest border border-white/5">
                                        {alt.trim()}
                                    </span>
                                ))}
                            </div>
                        )}

                        <p className="text-white/80 text-xl font-medium line-clamp-2 mb-8 max-w-2xl leading-relaxed">
                            {recipe.description}
                        </p>

                        {/* Rating and Tags Section */}
                        <div className="space-y-4">
                            {/* Stars directly above hashtags */}
                            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full w-fit border border-white/10">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={(e) => { e.stopPropagation(); setUserRating(star); }}
                                        className="transition-transform hover:scale-125 focus:outline-none"
                                    >
                                        <Star
                                            size={14}
                                            className={`${star <= (userRating || recipe.rating || 0)
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                                }`}
                                        />
                                    </button>
                                ))}
                                <span className="text-[8px] font-black text-white/50 uppercase tracking-widest ml-2">Rating</span>
                            </div>

                            {recipe.tags && recipe.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {recipe.tags.map((tag: any) => (
                                        <span
                                            key={tag.id}
                                            className="px-3 py-1.5 bg-white/10 backdrop-blur-md text-white/70 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10"
                                        >
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 sm:gap-8 text-white font-black uppercase tracking-widest text-[10px] w-full relative z-10 mt-6 sm:mt-10"
                    >
                        <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl"><Clock size={16} /></div>
                                <span>{recipe.time_minutes} min total</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl"><Flame size={16} /></div>
                                <span>{recipe.nutrition?.calories ? `${recipe.nutrition.calories} kcal` : `${Math.round(baseCalories)} kcal`}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/10 rounded-xl"><span className="text-sm">👥</span></div>
                                <span>{(recipe.servings || 1) * multiplier} servings</span>
                            </div>
                        </div>

                        {/* Usage Stats - Centered & Large */}
                        <div className="flex items-center gap-12 sm:gap-16 py-2">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-white/50 mb-1 font-black">THIS MONTH</span>
                                <span className="text-5xl font-black text-white leading-none">{usageStats.month}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-white/50 mb-1 font-black">THIS YEAR</span>
                                <span className="text-5xl font-black text-white leading-none">{usageStats.year}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-white/50 mb-1 font-black">ALL TIME</span>
                                <span className="text-5xl font-black text-white leading-none">{usageStats.allTime}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 print:hidden w-full sm:w-auto justify-start sm:justify-end">
                            <button
                                onClick={handleShare}
                                className="bg-white/20 backdrop-blur-sm p-2 sm:px-3 sm:py-1.5 rounded-xl hover:bg-white/30 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white border border-white/10 shadow-sm"
                                title="Share"
                            >
                                <Share2 size={14} />
                                <span className="hidden sm:inline">Share</span>
                            </button>
                            <button
                                onClick={async () => {
                                    await toggleLike(recipe?.id || '');
                                    fetchLikesCount();
                                }}
                                className={`backdrop-blur-sm p-2 sm:px-3 sm:py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-white/10 ${likes.includes(recipe?.id || '')
                                    ? 'bg-rose-500 text-white border-rose-400'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Heart size={14} fill={likes.includes(recipe?.id || '') ? "currentColor" : "none"} />
                                <span className="hidden sm:inline">Like</span>
                                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px]">{likesCount}</span>
                            </button>
                            <button
                                onClick={() => toggleFavorite(recipe?.id || '')}
                                className={`backdrop-blur-sm p-2 sm:px-3 sm:py-1.5 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-white/10 ${favorites.includes(recipe?.id || '')
                                    ? 'bg-amber-500 text-white border-amber-400'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                <Star size={14} fill={favorites.includes(recipe?.id || '') ? "currentColor" : "none"} />
                                <span className="hidden sm:inline">Favorite</span>
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="bg-white/20 backdrop-blur-sm p-2 sm:px-3 sm:py-1.5 rounded-xl hover:bg-white/30 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white border border-white/10 shadow-sm"
                                title="Print"
                            >
                                <Printer size={14} />
                                <span className="hidden sm:inline">Print</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Image Gallery Section */}
                {recipe.gallery_urls && recipe.gallery_urls.length > 0 && (
                    <section className="mb-20">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl">📸</div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Photo Gallery</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {recipe.gallery_urls.map((image, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ scale: 1.02 }}
                                    className="relative aspect-square rounded-[2rem] overflow-hidden group border border-gray-100 shadow-sm cursor-zoom-in"
                                    onClick={() => setSelectedImage(image.url)}
                                >
                                    <img src={image.url} alt={image.caption || `Gallery ${idx}`} className="w-full h-full object-cover" />
                                    {image.caption && (
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                            <p className="text-white text-[10px] font-bold uppercase tracking-widest">{image.caption}</p>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Sidebar: Ingredients & Nutrition Facts */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white p-8 rounded-[3rem] shadow-xl shadow-gray-100/50 border border-gray-100 sticky top-8">
                            <div className="flex flex-col gap-6 mb-10">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Ingredients</h2>
                                    <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                                        <button
                                            onClick={() => setMultiplier(Math.max(0.25, multiplier - 0.25))}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 hover:bg-gray-100 transition-colors shadow-sm"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <div className="flex flex-col items-center px-1">
                                            <span className="text-xs font-black leading-none">{multiplier}x</span>
                                            <span className="text-[6px] font-black uppercase text-gray-400 mt-1">Batch</span>
                                        </div>
                                        <button
                                            onClick={() => setMultiplier(multiplier + 0.25)}
                                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 hover:bg-gray-100 transition-colors shadow-sm"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 rounded-2xl border border-primary-100/50">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-primary-600 uppercase tracking-widest">Recipe Servings</span>
                                        <span className="text-xs font-bold text-primary-900">{recipe.servings || 4} people</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 mb-12">
                                {Object.entries(
                                    recipe.ingredients.reduce((groups, ing, index) => {
                                        const groupName = ing.group_name || 'Ingredients';
                                        if (!groups[groupName]) groups[groupName] = [];
                                        groups[groupName].push({ ...ing, originalIndex: index });
                                        return groups;
                                    }, {} as Record<string, any[]>)
                                ).map(([groupName, ings]) => (
                                    <div key={groupName} className="space-y-3">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-500 mb-2 px-2">{groupName}</h3>
                                        <div className="space-y-2">
                                            {ings.map((ing) => (
                                                <div
                                                    key={ing.originalIndex}
                                                    className="flex items-center gap-4 group/item"
                                                >
                                                    {/* Checkbox for Cart Selection */}
                                                    <button
                                                        onClick={() => toggleSelectedForCart(ing.originalIndex)}
                                                        className={`flex-shrink-0 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${selectedForCart.includes(ing.originalIndex)
                                                            ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-100'
                                                            : 'border-gray-200 hover:border-primary-200'
                                                            }`}
                                                    >
                                                        {selectedForCart.includes(ing.originalIndex) && <Check size={14} strokeWidth={4} />}
                                                    </button>

                                                    {/* Ingredient Info - Clickable for Crossing Out */}
                                                    <div
                                                        onClick={() => toggleCrossed(ing.originalIndex)}
                                                        className="flex-1 flex items-center justify-between cursor-pointer py-2 px-3 hover:bg-gray-50 rounded-2xl transition-colors"
                                                    >
                                                        <span className={`font-bold transition-all text-sm ${crossedIngredients.includes(ing.originalIndex) ? 'line-through text-gray-300 scale-95 origin-left' : 'text-gray-700'}`}>
                                                            {ing.ingredient.name}
                                                        </span>
                                                        <span className={`text-[10px] font-black transition-all uppercase tracking-widest ${crossedIngredients.includes(ing.originalIndex) ? 'text-gray-200' : 'text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full'}`}>
                                                            {Math.round(ing.amount_in_grams * multiplier)} {ing.unit || 'g'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-5">
                                <button
                                    onClick={handleAddSelectedToCart}
                                    disabled={addingToCart || selectedForCart.length === 0}
                                    className="w-full py-5 bg-gray-900 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 hover:bg-primary-600 transition-all shadow-2xl disabled:opacity-50 disabled:bg-gray-200 shadow-gray-200"
                                >
                                    {addingToCart ? <Loader2 className="animate-spin" /> : <ShoppingCart size={24} />}
                                    {addingToCart ? 'Syncing...' : `Add ${selectedForCart.length} to Cart`}
                                </button>
                                <div className="flex justify-center">
                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] text-center">
                                        Checked items join your weekly list
                                    </span>
                                </div>
                            </div>

                            {/* Nutrition Facts Sidebar Item */}
                            <div className="mt-14 pt-10 border-t-4 border-gray-50 hidden lg:block">
                                <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4 uppercase tracking-tighter">
                                    <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-xl shadow-inner">📊</div>
                                    Nutrition Facts
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Prot', value: recipe.nutrition?.protein, unit: 'g', color: 'text-rose-600', bg: 'bg-rose-50' },
                                        { label: 'Carbs', value: recipe.nutrition?.carbs, unit: 'g', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                        { label: 'Fat', value: recipe.nutrition?.fat, unit: 'g', color: 'text-amber-600', bg: 'bg-amber-50' },
                                        { label: 'Kcal', value: recipe.nutrition?.calories || Math.round(baseCalories), unit: '', color: 'text-emerald-600', bg: 'bg-emerald-50' }
                                    ].map((stat, i) => (
                                        <div key={i} className={`${stat.bg} p-6 rounded-[2rem] flex flex-col items-center justify-center transform hover:scale-105 transition-transform border border-white shadow-sm`}>
                                            <span className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.value || 0}{stat.unit}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 opacity-60">{stat.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Column: Video & Instructions */}
                    <div className="lg:col-span-2 space-y-12">
                        {videoData && (
                            <section className="bg-white p-3 rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden group">
                                <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden relative">
                                    {videoData.type === 'embed' ? (
                                        <iframe
                                            src={videoData.url}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                            title="Recipe Video"
                                        />
                                    ) : (
                                        <video
                                            src={videoData.url}
                                            className="w-full h-full"
                                            controls
                                            playsInline
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    )}
                                </div>
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center">
                                            <Play size={20} className="text-primary-600" />
                                        </div>
                                        <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Video Tutorial</span>
                                    </div>
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                        Full-width cinematic view
                                    </div>
                                </div>
                            </section>
                        )}

                        <section className="bg-white p-8 sm:p-14 rounded-[3.5rem] shadow-xl shadow-gray-100/50 border border-gray-100">
                            <div className="flex items-center gap-5 mb-14">
                                <div className="w-14 h-14 rounded-[1.5rem] bg-purple-50 flex items-center justify-center text-3xl shadow-inner">👩‍🍳</div>
                                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Cooking Steps</h2>
                            </div>

                            <div className="space-y-16">
                                {recipe.steps.map((step, index) => {
                                    // Handle both old string steps and new object steps
                                    const stepData = typeof step === 'string' ? { text: step } : step;

                                    return (
                                        <div
                                            key={index}
                                            className="flex flex-col gap-8 group cursor-pointer"
                                            onClick={() => toggleStepCrossed(index)}
                                        >
                                            <div className="flex items-start gap-8">
                                                <div className={`flex-shrink-0 w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-2xl font-black transition-all shadow-inner ${crossedSteps.includes(index)
                                                    ? 'bg-gray-100 text-gray-300'
                                                    : 'bg-gray-50 text-gray-200 group-hover:bg-primary-50 group-hover:text-primary-600'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="pt-3 flex-1">
                                                    <p className={`leading-relaxed font-bold text-xl tracking-tight transition-all ${crossedSteps.includes(index) ? 'text-gray-300 line-through' : 'text-gray-700'
                                                        }`}>
                                                        {stepData.text}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step Image (New Feature) */}
                                            {stepData.image_url && (
                                                <div className={`w-full flex ${stepData.alignment === 'center' ? 'justify-center' : stepData.alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
                                                    <motion.div
                                                        whileHover={{ scale: 1.01 }}
                                                        className={`relative overflow-hidden rounded-[2.5rem] shadow-lg border border-gray-100 cursor-zoom-in group ${stepData.alignment === 'full' ? 'w-full' : 'max-w-md'
                                                            }`}
                                                        onClick={() => setSelectedImage(stepData.image_url || null)}
                                                    >
                                                        <img
                                                            src={stepData.image_url}
                                                            alt={`Step ${index + 1}`}
                                                            className="w-full h-full object-cover max-h-[400px]"
                                                        />
                                                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Maximize2 size={16} className="text-white" />
                                                        </div>
                                                    </motion.div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Reviews Section */}
                        <section id="reviews" className="bg-white p-8 sm:p-14 rounded-[3.5rem] shadow-xl shadow-gray-100/50 border border-gray-100">
                            <div className="flex items-center justify-between mb-12">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-[1.5rem] bg-amber-50 flex items-center justify-center text-3xl shadow-inner">⭐</div>
                                    <div>
                                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Family Reviews</h2>
                                        <p className="text-gray-500 font-medium">What the kitchen crew thinks.</p>
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                                    <MessageSquare size={16} className="text-primary-500" />
                                    <span className="text-xs font-black text-gray-900">{reviews.length}</span>
                                </div>
                            </div>

                            {/* Review Form */}
                            {currentUserId && (
                                <form onSubmit={handleSubmitReview} className="mb-16 bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100">
                                    <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight">Write a Review</h3>

                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Your Rating:</span>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setUserRating(star)}
                                                        className="transition-transform hover:scale-125"
                                                    >
                                                        <Star
                                                            size={24}
                                                            className={`${star <= (userRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <textarea
                                                value={reviewComment}
                                                onChange={(e) => setReviewComment(e.target.value)}
                                                placeholder="Share your thoughts on this recipe..."
                                                className="w-full h-32 p-6 bg-white border-2 border-gray-100 rounded-2xl focus:border-primary-500 focus:outline-none font-medium transition-all resize-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submittingReview || userRating === 0}
                                            className="self-end px-10 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-600 transition-all shadow-xl disabled:opacity-50"
                                        >
                                            {submittingReview ? <Loader2 className="animate-spin inline-block mr-2" /> : null}
                                            Submit Review
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Reviews List */}
                            <div className="space-y-8">
                                {reviews.length > 0 ? (
                                    reviews.map((review) => (
                                        <div key={review.id} className="group relative">
                                            <div className="flex items-start gap-6 border-b border-gray-100 pb-8 last:border-0">
                                                <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-600 font-black text-xl">
                                                    {review.profiles?.username?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-black text-gray-900">{review.profiles?.username || 'Family Member'}</span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {new Date(review.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-0.5 mb-3">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <Star
                                                                key={star}
                                                                size={12}
                                                                className={`${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-gray-600 font-medium leading-relaxed">
                                                        {review.comment}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200">
                                        <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">No reviews yet. Be the first!</p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Source Links */}
                        {recipe.source_url && (
                            <div className="pt-10 flex justify-center">
                                <a
                                    href={recipe.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-4 px-10 py-5 bg-gray-50 text-gray-400 rounded-[2rem] hover:bg-gray-900 hover:text-white transition-all font-black border border-gray-100 shadow-sm uppercase tracking-[0.2em] text-[10px]"
                                >
                                    <ExternalLink size={20} />
                                    <span>Original Recipe Source</span>
                                </a>
                            </div>
                        )}

                        {/* Mobile Nutrition Facts (Only visible on small screens) */}
                        <div className="block lg:hidden mt-20 pt-10 border-t-4 border-gray-50">
                            <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4 uppercase tracking-tighter">
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-xl shadow-inner">📊</div>
                                Nutrition Facts
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Prot', value: recipe.nutrition?.protein, unit: 'g', color: 'text-rose-600', bg: 'bg-rose-50' },
                                    { label: 'Carbs', value: recipe.nutrition?.carbs, unit: 'g', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                    { label: 'Fat', value: recipe.nutrition?.fat, unit: 'g', color: 'text-amber-600', bg: 'bg-amber-50' },
                                    { label: 'Kcal', value: recipe.nutrition?.calories || Math.round(baseCalories), unit: '', color: 'text-emerald-600', bg: 'bg-emerald-50' }
                                ].map((stat, i) => (
                                    <div key={i} className={`${stat.bg} p-6 rounded-[2rem] flex flex-col items-center justify-center transform hover:scale-105 transition-transform border border-white shadow-sm`}>
                                        <span className={`text-2xl font-black ${stat.color} tracking-tighter`}>{stat.value || 0}{stat.unit}</span>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 opacity-60">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
