import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRecipes, useTopTags, useRecipeStats } from '@/lib/hooks';
import RecipeCard from '@/components/RecipeCard';
import { Search as SearchIcon, Frown, Hash, SortAsc, SortDesc } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Search() {
    const { recipes, loading, error } = useRecipes();
    const { tags: topTags } = useTopTags(12);
    const { stats: recipeStats } = useRecipeStats();

    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'rating' | 'times_used'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const filteredRecipes = recipes.filter(recipe => {
        if (!query) return true;
        const searchTerms = query.toLowerCase();
        return (
            recipe.title.toLowerCase().includes(searchTerms) ||
            recipe.description?.toLowerCase().includes(searchTerms) ||
            recipe.category?.name.toLowerCase().includes(searchTerms) ||
            recipe.tags?.some(tag => tag.name.toLowerCase().includes(searchTerms)) ||
            recipe.ingredients?.some(ing => ing.ingredient.name.toLowerCase().includes(searchTerms))
        );
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

    const handleTagClick = (tagName: string) => {
        setSearchParams({ q: tagName });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Searching recipes...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md p-6 bg-red-50 rounded-2xl border border-red-100">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
                    <p className="text-red-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-12">
            <div className="container mx-auto px-4 max-w-[1800px]">
                <header className="mb-12">
                    <div className="flex flex-col gap-8">
                        {/* Title and Stats */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 pb-8">
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 font-display tracking-tight mb-2">
                                    {query ? 'Search Results' : 'Explore Recipes'}
                                </h1>
                                <p className="text-gray-500 font-medium italic">
                                    {filteredRecipes.length} {filteredRecipes.length === 1 ? 'masterpiece' : 'delightful recipes'} {query ? `found for "${query}"` : 'at your fingertips'}
                                </p>
                            </div>
                        </div>

                        {/* Search and Sort Row */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            {/* Smaller Search Bar on the Left */}
                            <div className="w-full max-w-xl group">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        setSearchParams({ q: formData.get('search') as string });
                                    }}
                                    className="relative w-full"
                                >
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="search"
                                        defaultValue={query}
                                        placeholder="Search by name, ingredient, or tag..."
                                        className="block w-full pl-14 pr-28 py-4 border-2 border-gray-100 rounded-2xl bg-white ring-offset-background placeholder:text-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-50/30 transition-all font-bold text-lg shadow-sm"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all active:scale-95"
                                    >
                                        Search
                                    </button>
                                </form>

                                {/* Top Hashtags - Directly below search bar */}
                                {topTags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {topTags.map((tag) => (
                                            <button
                                                key={tag.name}
                                                onClick={() => handleTagClick(tag.name)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5 uppercase tracking-widest ${query.toLowerCase() === tag.name.toLowerCase()
                                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-100'
                                                    : 'bg-white text-gray-400 hover:bg-primary-50 hover:text-primary-600 border border-gray-100 shadow-sm'
                                                    }`}
                                            >
                                                <Hash size={12} className={query.toLowerCase() === tag.name.toLowerCase() ? 'text-white' : 'text-primary-400'} />
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sorting UI on the Right side */}
                            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm self-end lg:self-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Sort</span>
                                <div className="h-4 w-px bg-gray-100" />
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-transparent border-none focus:ring-0 font-bold text-sm text-gray-600 px-4 py-1.5 cursor-pointer"
                                >
                                    <option value="created_at">Date Added</option>
                                    <option value="title">Name</option>
                                    <option value="rating">Rating</option>
                                    <option value="times_used">Times Used</option>
                                </select>
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    className="p-2 hover:bg-gray-50 rounded-xl transition-all text-primary-600 border border-transparent hover:border-primary-100"
                                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                                >
                                    {sortOrder === 'asc' ? <SortAsc size={20} /> : <SortDesc size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {filteredRecipes.length > 0 ? (
                    <div className="grid grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4 lg:gap-8">
                        {filteredRecipes.map((recipe) => (
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
                            We couldn't find any recipes matching your search. Try different keywords or browse our categories.
                        </p>
                        <button
                            onClick={() => setSearchParams({})}
                            className="inline-flex items-center justify-center px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
                        >
                            View All Recipes
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
