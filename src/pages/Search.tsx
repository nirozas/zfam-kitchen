import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRecipes, useTopTags, useRecipeStats, useCategories } from '@/lib/hooks';
import RecipeCard from '@/components/RecipeCard';
import { Search as SearchIcon, Frown, Hash, SortAsc, SortDesc, Filter, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Search() {
    const { recipes, loading, error } = useRecipes();
    const { tags: topTags } = useTopTags(12);
    const { stats: recipeStats } = useRecipeStats();
    const { categories } = useCategories();

    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [localQuery, setLocalQuery] = useState(query);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'rating' | 'times_used' | 'category'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [gridDensity, setGridDensity] = useState(2); // 1 = large, 2 = normal, 3 = compact

    const filteredRecipes = useMemo(() => {
        return recipes.filter(recipe => {
            const searchTerms = query.toLowerCase();
            const matchesSearch = !query || (
                recipe.title.toLowerCase().includes(searchTerms) ||
                recipe.description?.toLowerCase().includes(searchTerms) ||
                recipe.category?.name.toLowerCase().includes(searchTerms) ||
                recipe.tags?.some(tag => tag.name.toLowerCase().includes(searchTerms)) ||
                recipe.ingredients?.some(ing => ing.ingredient.name.toLowerCase().includes(searchTerms))
            );

            const matchesCategory = selectedCategories.length === 0 ||
                (recipe.category && selectedCategories.includes(recipe.category.id));

            return matchesSearch && matchesCategory;
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
            } else if (sortBy === 'category') {
                comparison = (a.category?.name || '').localeCompare(b.category?.name || '');
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [recipes, query, selectedCategories, sortBy, sortOrder, recipeStats]);

    const handleTagClick = (tagName: string) => {
        setLocalQuery(tagName);
        setSearchParams({ q: tagName });
        setIsSearchFocused(false);
    };

    // Keep localQuery synced with URL params if they change externally
    useEffect(() => {
        setLocalQuery(query);
    }, [query]);

    type Suggestion = 
        | { type: 'tag'; title: string }
        | { type: 'recipe'; id: string | number; title: string; slug: string | null | undefined; image_url: string | null | undefined; category: string | undefined };

    // Live search suggestions
    const searchSuggestions = useMemo<Suggestion[]>(() => {
        if (!localQuery.trim()) return [];
        const terms = localQuery.toLowerCase();
        
        // Find matching recipes (limit to 5)
        const matchedRecipes: Suggestion[] = recipes
            .filter(r => r.title.toLowerCase().includes(terms))
            .slice(0, 5)
            .map(r => ({ type: 'recipe' as const, id: r.id, title: r.title, slug: r.slug, image_url: r.image_url, category: r.category?.name }));

        // Find matching tags (limit to 3)
        const allTags = Array.from(new Set(recipes.flatMap(r => r.tags?.map(t => t.name) || [])));
        const matchedTags: Suggestion[] = allTags
            .filter(t => t.toLowerCase().includes(terms))
            .slice(0, 3)
            .map(t => ({ type: 'tag' as const, title: t }));

        return [...matchedTags, ...matchedRecipes];
    }, [localQuery, recipes]);

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
                                <h1 className="text-4xl font-black text-gray-900 font-sans tracking-tight mb-2">
                                    {query ? 'Search Results' : 'Explore Recipes'}
                                </h1>
                                <p className="text-gray-500 font-medium italic">
                                    {filteredRecipes.length} {filteredRecipes.length === 1 ? 'masterpiece' : 'delightful recipes'} {query ? `found for "${query}"` : 'at your fingertips'}
                                </p>
                            </div>

                            {/* Mobile Zoom Controls */}
                            <div className="flex sm:hidden items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm self-start">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Zoom</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setGridDensity(prev => Math.max(1, prev - 1))}
                                        disabled={gridDensity === 1}
                                        className="p-2 bg-gray-50 rounded-xl disabled:opacity-30"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <button
                                        onClick={() => setGridDensity(prev => Math.min(3, prev + 1))}
                                        disabled={gridDensity === 3}
                                        className="p-2 bg-gray-50 rounded-xl disabled:opacity-30"
                                    >
                                        <X size={16} className="rotate-45" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Search and Sort Row */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-50">
                            {/* Smaller Search Bar on the Left */}
                            <div className="w-full max-w-xl group relative">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        setSearchParams({ q: localQuery });
                                        setIsSearchFocused(false);
                                    }}
                                    className="relative w-full z-20"
                                >
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="search"
                                        value={localQuery}
                                        onChange={(e) => setLocalQuery(e.target.value)}
                                        onFocus={() => setIsSearchFocused(true)}
                                        onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                        placeholder="Search by name, ingredient, or tag..."
                                        className="block w-full pl-14 pr-28 py-4 border-2 border-gray-100 rounded-2xl bg-white ring-offset-background placeholder:text-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-50/30 transition-all font-bold text-lg shadow-sm"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all active:scale-95 z-10"
                                    >
                                        Search
                                    </button>
                                </form>

                                {/* Autocomplete Dropdown */}
                                <AnimatePresence>
                                    {isSearchFocused && localQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-20 flex flex-col"
                                        >
                                            {searchSuggestions.map((suggestion, idx) => (
                                                <button
                                                    key={`${suggestion.type}-${idx}`}
                                                    onClick={() => {
                                                        if (suggestion.type === 'tag') {
                                                            handleTagClick(suggestion.title);
                                                        } else {
                                                            setLocalQuery(suggestion.title);
                                                            setSearchParams({ q: suggestion.title });
                                                            setIsSearchFocused(false);
                                                            // Alternatively, navigate to the recipe directly? No, search results are good.
                                                        }
                                                    }}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-b-0 group"
                                                >
                                                    {suggestion.type === 'recipe' ? (
                                                        <>
                                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                                                {suggestion.image_url ? (
                                                                    <img src={suggestion.image_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">{suggestion.title.substring(0,2)}</div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-sm text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">{suggestion.title}</h4>
                                                                {suggestion.category && <p className="text-[10px] uppercase font-black tracking-wider text-gray-400">{suggestion.category}</p>}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 flex-shrink-0">
                                                                <Hash size={16} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-sm text-gray-900 group-hover:text-primary-600 transition-colors">Search for #{suggestion.title}</h4>
                                                            </div>
                                                        </>
                                                    )}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Top Hashtags - Directly below search bar */}
                                {topTags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4 relative z-0">
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
                                    <option value="category">Category</option>
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

                                <div className="h-4 w-px bg-gray-100" />

                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedCategories.length > 0 || isFilterOpen ? 'bg-primary-600 text-white shadow-lg shadow-primary-100' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}
                                >
                                    <Filter size={16} />
                                    Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
                                </button>
                            </div>
                        </div>

                        {/* Category Filter Dropdown */}
                        <AnimatePresence>
                            {isFilterOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Filter by Category</h3>
                                        <div className="flex gap-4">
                                            {selectedCategories.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedCategories([])}
                                                    className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setIsFilterOpen(false)}
                                                className="text-gray-400 hover:text-gray-600"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {categories.map(cat => (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setSelectedCategories(prev =>
                                                        prev.includes(cat.id)
                                                            ? prev.filter(id => id !== cat.id)
                                                            : [...prev, cat.id]
                                                    );
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedCategories.includes(cat.id)
                                                    ? 'bg-primary-50 border-primary-200 text-primary-700 shadow-sm'
                                                    : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                {
                    filteredRecipes.length > 0 ? (
                        <div className={`grid ${gridDensity === 1 ? 'grid-cols-1' :
                                gridDensity === 2 ? 'grid-cols-2' :
                                    'grid-cols-3'
                            } md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4 lg:gap-8`}>
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
                    )
                }
            </div >
        </div >
    );
}
