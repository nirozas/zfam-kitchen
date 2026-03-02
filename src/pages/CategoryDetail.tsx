import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useRecipes, useCategories, useTopTags, useRecipeStats } from '@/lib/hooks';
import RecipeCard from '@/components/RecipeCard';
import { ArrowLeft, Frown, ChefHat, Plus, SortAsc, SortDesc, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';

export default function CategoryDetail() {
    const params = useParams();
    const slug = params['*'] || '';
    const [searchParams, setSearchParams] = useSearchParams();
    const tagQuery = searchParams.get('q') || '';

    const { recipes, loading: recipesLoading, error: recipesError } = useRecipes();
    const { categories, loading: categoriesLoading } = useCategories();
    const { tags: topTags } = useTopTags(12);
    const { stats: recipeStats } = useRecipeStats();

    const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'rating' | 'times_used'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [localQuery, setLocalQuery] = useState('');

    const category = categories.find(c => c.slug === slug);
    const categoryId = category?.id || null;

    // Filter and sort recipes
    const categoryRecipes = useMemo(() => {
        if (!categoryId) return [];

        // If this category has subcategories, we should include their recipes too!
        const subCategories = categories.filter(c => c.parent_id === categoryId);
        const categoryIdsToMatch = [categoryId, ...subCategories.map(c => c.id)];

        return recipes.filter(recipe => {
            const matchesCategory = recipe.category && categoryIdsToMatch.includes(recipe.category.id);
            const matchesTag = !tagQuery || recipe.tags?.some(tag => tag.name.toLowerCase() === tagQuery.toLowerCase());
            const matchesSearch = !localQuery || recipe.title.toLowerCase().includes(localQuery.toLowerCase());
            return matchesCategory && matchesTag && matchesSearch;
        }).sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'title') {
                comparison = a.title.localeCompare(b.title);
            } else if (sortBy === 'created_at') {
                comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            } else if (sortBy === 'rating') {
                comparison = (a.rating || 0) - (b.rating || 0);
            } else if (sortBy === 'times_used') {
                comparison = (recipeStats[a.id] || 0) - (recipeStats[b.id] || 0);
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [recipes, categoryId, tagQuery, localQuery, sortBy, sortOrder, recipeStats]);

    const handleTagClick = (tagName: string) => {
        if (tagQuery.toLowerCase() === tagName.toLowerCase()) {
            setSearchParams({});
        } else {
            setSearchParams({ q: tagName });
        }
    };

    const loading = recipesLoading || categoriesLoading;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading category...</p>
                </div>
            </div>
        );
    }

    if (recipesError || !category) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-red-50 rounded-2xl border border-red-100">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Category Not Found</h2>
                    <p className="text-gray-600 mb-6">
                        {recipesError || "The category you are looking for does not exist."}
                    </p>
                    <Link to="/categories" className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Categories
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header Section */}
            <div className="bg-white border-b border-gray-100">
                <div className="container mx-auto px-4 py-8 max-w-[1800px]">
                    <div className="flex items-center justify-between mb-4">
                        <Link to="/categories" className="inline-flex items-center text-gray-400 hover:text-primary-600 transition-colors font-bold uppercase text-[10px] tracking-widest">
                            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                            Back to Categories
                        </Link>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                        {/* Category Image */}
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] overflow-hidden bg-gray-50 border-4 border-white shadow-xl shrink-0">
                            {category.image_url ? (
                                <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50">
                                    <ChefHat size={48} />
                                </div>
                            )}
                        </div>

                        {/* Category Info */}
                        <div className="flex-1 text-center md:text-left pt-2">
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-2 font-display tracking-tighter">
                                {category.name}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    {categoryRecipes.length} recipes
                                </span>

                                {/* Hashtags */}
                                <div className="flex flex-wrap gap-1.5 ml-2">
                                    {topTags.slice(0, 5).map((tag) => (
                                        <button
                                            key={tag.name}
                                            onClick={() => handleTagClick(tag.name)}
                                            className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 uppercase tracking-widest ${tagQuery.toLowerCase() === tag.name.toLowerCase()
                                                ? 'bg-primary-600 text-white shadow-md'
                                                : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'
                                                }`}
                                        >
                                            #{tag.name}
                                        </button>
                                    ))}
                                </div>

                                {tagQuery && (
                                    <button
                                        onClick={() => setSearchParams({})}
                                        className="text-[9px] font-black text-primary-600 uppercase tracking-widest hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>

                            {/* Back to Parent (if is subcategory) */}
                            {category?.parent_id && (
                                <div className="mt-4 flex justify-center md:justify-start border-t border-gray-100 pt-4">
                                    <Link to={`/category/${categories.find(c => c.id === category.parent_id)?.slug}`} className="text-xs font-black text-gray-500 hover:text-primary-600 uppercase tracking-widest flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 transition-colors">
                                        <ArrowLeft size={14} /> Back to {categories.find(c => c.id === category.parent_id)?.name}
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Search and Sort - Moved up and right */}
                        <div className="flex flex-col items-end gap-3 self-center">
                            <Link
                                to={`/create?category=${categoryId}`}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg hover:-translate-y-0.5"
                            >
                                <Plus size={16} />
                                Add Recipe
                            </Link>

                            <div className="flex items-center gap-2">
                                {/* Compact Search Bar */}
                                <div className="w-48 relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-3.5 w-3.5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={localQuery}
                                        onChange={(e) => setLocalQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="block w-full pl-8 pr-8 py-2 border-2 border-gray-100 rounded-xl bg-white focus:outline-none focus:border-primary-500 transition-all font-bold text-xs"
                                    />
                                </div>

                                {/* Compact Sort */}
                                <div className="flex items-center bg-white px-2 py-1 rounded-xl border border-gray-100">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                        className="bg-transparent border-none focus:ring-0 font-bold text-[10px] text-gray-500 uppercase tracking-widest px-2 py-1 cursor-pointer"
                                    >
                                        <option value="created_at">Date</option>
                                        <option value="title">Name</option>
                                        <option value="rating">Rating</option>
                                    </select>
                                    <button
                                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                        className="p-1 text-primary-600 hover:bg-gray-50 rounded"
                                    >
                                        {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Sub-Categories Grid */}
            {category && categories.some(c => c.parent_id === category.id) && (
                <div className="container mx-auto px-4 pt-8 pb-4 max-w-[1800px]">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">Sub-Categories</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {categories.filter(c => c.parent_id === category.id).map(sub => (
                            <Link key={sub.id} to={`/category/${sub.slug}`} className="group bg-white rounded-3xl p-5 text-center border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner shrink-0 border-2 border-white group-hover:border-primary-100 transition-colors">
                                    {sub.image_url ? (
                                        <img src={sub.image_url} alt={sub.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <ChefHat className="text-gray-300" size={24} />
                                    )}
                                </div>
                                <span className="text-[11px] font-black text-gray-700 leading-tight uppercase tracking-wider group-hover:text-primary-600 transition-colors">{sub.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Recipes Grid */}
            <div className="container mx-auto px-4 py-8 max-w-[1800px]">
                {categoryRecipes.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-6">
                        {categoryRecipes.map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-24 bg-white rounded-[3rem] border border-gray-100 shadow-sm"
                    >
                        <div className="mb-6 inline-flex p-8 bg-gray-50 rounded-full text-gray-400">
                            <Frown size={64} />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-2">No recipes found</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto font-medium">
                            {tagQuery
                                ? `We couldn't find any recipes in this category tagged with #${tagQuery}.`
                                : "We haven't added any recipes to this category yet."}
                        </p>
                        <div className="flex justify-center gap-4">
                            {tagQuery && (
                                <button onClick={() => setSearchParams({})} className="px-8 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all">
                                    Clear Tag Filter
                                </button>
                            )}
                            <Link to={`/create?category=${categoryId}`} className="inline-flex items-center justify-center px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
                                <Plus size={20} className="mr-2" />
                                Add a Recipe
                            </Link>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
