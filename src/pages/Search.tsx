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
    const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isIngredientFocused, setIsIngredientFocused] = useState(false);
    const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'rating' | 'times_used' | 'category'>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [gridDensity, setGridDensity] = useState(2); // 1 = large, 2 = normal, 3 = compact

    // Collect unique ingredients and their translations from all fetched recipes
    const ingredientsData = useMemo(() => {
        const ingsMap = new Map<string, { name: string, name_ar?: string, name_he?: string, name_es?: string }>();
        recipes.forEach(r => {
            r.ingredients?.forEach(i => {
                if (i.ingredient?.name) {
                    const name = i.ingredient.name;
                    if (!ingsMap.has(name.toLowerCase())) {
                        ingsMap.set(name.toLowerCase(), {
                            name,
                            name_ar: (i.ingredient as any).name_ar,
                            name_he: (i.ingredient as any).name_he,
                            name_es: (i.ingredient as any).name_es,
                        });
                    }
                }
            });
        });
        return Array.from(ingsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [recipes]);

    // Helper to get formatted translation label
    const getIngredientLabel = (name: string) => {
        const data = ingredientsData.find(ing => ing.name.toLowerCase() === name.toLowerCase());
        if (!data) return name;
        const translations = [data.name_ar, data.name_he, data.name_es].filter(Boolean);
        return translations.length > 0 ? `${name} (${translations.join(' / ')})` : name;
    };

    const ingredientSuggestions = useMemo(() => {
        if (!ingredientSearch.trim()) return [];
        const terms = ingredientSearch.toLowerCase();
        return ingredientsData
            .filter(ing => 
                (ing.name.toLowerCase().includes(terms) || 
                 ing.name_ar?.includes(terms) || 
                 ing.name_he?.includes(terms) || 
                 ing.name_es?.toLowerCase().includes(terms)) && 
                !selectedIngredients.some(si => si.toLowerCase() === ing.name.toLowerCase())
            )
            .slice(0, 5);
    }, [ingredientSearch, ingredientsData, selectedIngredients]);

    const filteredRecipes = useMemo(() => {
        return recipes.filter(recipe => {
            const searchTerms = localQuery.toLowerCase();
            const matchesSearch = !localQuery || (
                recipe.title.toLowerCase().includes(searchTerms) ||
                recipe.description?.toLowerCase().includes(searchTerms) ||
                recipe.category?.name.toLowerCase().includes(searchTerms) ||
                recipe.tags?.some(tag => tag.name.toLowerCase().includes(searchTerms))
            );

            const matchesCategory = selectedCategories.length === 0 ||
                (recipe.category && selectedCategories.includes(recipe.category.id));

            const matchesIngredients = selectedIngredients.length === 0 ||
                selectedIngredients.every(si => 
                    recipe.ingredients?.some(ri => {
                        const searchLower = si.toLowerCase();
                        return (
                            ri.ingredient.name.toLowerCase().includes(searchLower) ||
                            (ri.ingredient as any).name_ar?.includes(si) ||
                            (ri.ingredient as any).name_he?.includes(si) ||
                            (ri.ingredient as any).name_es?.toLowerCase().includes(searchLower)
                        );
                    })
                );

            return matchesSearch && matchesCategory && matchesIngredients;
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
    }, [recipes, localQuery, selectedCategories, selectedIngredients, sortBy, sortOrder, recipeStats]);

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
        <div className="min-h-screen bg-gray-50/50 py-16 px-4">
            <div className="container mx-auto max-w-[1800px]">
                {/* Main Header Container */}
                <div className="flex flex-col gap-8 mb-16">
                    {/* Row 1: Title and Search */}
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 px-4">
                        <div className="text-left">
                            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-2 tracking-tight">
                                Explore Recipes
                            </h1>
                            <p className="text-gray-500 text-lg max-w-xl">
                                {filteredRecipes.length} {filteredRecipes.length === 1 ? 'masterpiece' : 'delightful recipes'} {localQuery ? `found for "${localQuery}"` : 'at your fingertips'}.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 lg:max-w-xl w-full">
                            <div className="relative group flex-1 w-full">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by name, tag, or category..."
                                    value={localQuery}
                                    onChange={(e) => {
                                        setLocalQuery(e.target.value);
                                        setSearchParams(prev => {
                                            if (e.target.value) prev.set('q', e.target.value);
                                            else prev.delete('q');
                                            return prev;
                                        }, { replace: true });
                                    }}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                    className="w-full pl-12 pr-6 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-400 transition-all font-medium text-base"
                                />

                                {/* Recipe Autocomplete Dropdown */}
                                <AnimatePresence>
                                    {isSearchFocused && localQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[70] flex flex-col"
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
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">{suggestion.title.substring(0, 2)}</div>
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
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Ingredients Search and Sort */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-6 px-4 z-40 relative">
                        {/* Ingredients Multi-select input */}
                        <div className="flex-1 max-w-xl group relative">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <Filter className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={ingredientSearch}
                                onChange={(e) => setIngredientSearch(e.target.value)}
                                onFocus={() => setIsIngredientFocused(true)}
                                onBlur={() => setTimeout(() => setIsIngredientFocused(false), 200)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && ingredientSearch.trim()) {
                                        setSelectedIngredients(prev => [...prev, ingredientSearch.trim()]);
                                        setIngredientSearch('');
                                        setIsIngredientFocused(false);
                                    }
                                }}
                                placeholder="Search recipes by ingredients..."
                                className="block w-full pl-14 pr-6 py-4 border-2 border-gray-100 rounded-2xl bg-white ring-offset-background placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/30 transition-all font-bold text-base shadow-sm"
                            />

                            {/* Ingredient Suggestions */}
                            <AnimatePresence>
                                {isIngredientFocused && ingredientSuggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[60] flex flex-col"
                                    >
                                        {ingredientSuggestions.map((ing) => (
                                            <button
                                                key={ing.name}
                                                onClick={() => {
                                                    setSelectedIngredients(prev => [...prev, ing.name]);
                                                    setIngredientSearch('');
                                                    setIsIngredientFocused(false);
                                                }}
                                                className="w-full flex items-center gap-3 p-4 hover:bg-indigo-50 transition-colors text-left border-b border-gray-50 last:border-b-0 group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 font-black text-xs">
                                                    <Plus size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-sm text-gray-900 group-hover:text-indigo-600 transition-colors">
                                                        {ing.name}
                                                    </h4>
                                                    {(ing.name_ar || ing.name_he || ing.name_es) && (
                                                        <p className="text-[10px] text-gray-400 font-medium truncate">
                                                            {[ing.name_ar, ing.name_he, ing.name_es].filter(Boolean).join(' • ')}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Selected Ingredients Chips */}
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-h-[40px]">
                            {selectedIngredients.map(ing => (
                                <motion.button
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    key={ing}
                                    onClick={() => setSelectedIngredients(prev => prev.filter(i => i !== ing))}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-500 transition-all shadow-md group"
                                    title={getIngredientLabel(ing)}
                                >
                                    <span className="max-w-[150px] truncate">{ing}</span>
                                    <X size={12} className="group-hover:rotate-90 transition-transform flex-shrink-0" />
                                </motion.button>
                            ))}
                            {selectedIngredients.length > 0 && (
                                <button
                                    onClick={() => setSelectedIngredients([])}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        {/* Sort Controls */}
                        <div className="flex shrink-0 items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Sort</span>
                            <div className="h-6 w-px bg-gray-100 mx-1"></div>
                            <select
                                value={sortBy}
                                onChange={(e: any) => setSortBy(e.target.value)}
                                className="bg-transparent border-none focus:ring-0 font-black text-[10px] uppercase tracking-widest cursor-pointer text-gray-700 hover:text-primary-600 transition-colors pr-8"
                            >
                                <option value="created_at">Newest</option>
                                <option value="title">Alphabetical</option>
                                <option value="rating">Top Rated</option>
                                <option value="times_used">Most Popular</option>
                                <option value="category">Category</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-2 bg-gray-50 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-all active:scale-95"
                            >
                                {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Row 3: Category Filter and Density */}
                    <div className="flex flex-wrap items-center justify-between gap-4 px-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md transition-all ${isFilterOpen ? 'bg-primary-600 text-white shadow-primary-200' : 'bg-white text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                                    }`}
                            >
                                <Filter size={14} /> Filter Categories
                                {selectedCategories.length > 0 && (
                                    <span className="flex items-center justify-center w-5 h-5 bg-white text-primary-600 rounded-full text-[10px]">
                                        {selectedCategories.length}
                                    </span>
                                )}
                            </button>

                            <div className="hidden lg:flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Density</span>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => setGridDensity(d)}
                                            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black transition-all ${gridDensity === d ? 'bg-primary-600 text-white shadow-lg shadow-primary-100' : 'bg-gray-50 text-gray-400 hover:bg-gray-200'
                                                }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Quick Tags */}
                        {topTags.length > 0 && !localQuery && (
                            <div className="flex flex-wrap gap-2">
                                {topTags.slice(0, 6).map((tag) => (
                                    <button
                                        key={tag.name}
                                        onClick={() => handleTagClick(tag.name)}
                                        className="px-3 py-1.5 bg-white text-gray-400 hover:bg-primary-50 hover:text-primary-600 border border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                    >
                                        #{tag.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Filter Dropdown */}
                <AnimatePresence>
                    {isFilterOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-white mx-4 mb-12 p-8 rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">Filter by Categories</h3>
                                <button
                                    onClick={() => setSelectedCategories([])}
                                    className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline px-4 py-2"
                                >
                                    Clear All
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
                                        className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all border text-center ${selectedCategories.includes(cat.id)
                                            ? 'bg-primary-600 border-primary-600 text-white shadow-lg'
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

                {/* Results Grid */}
                {filteredRecipes.length > 0 ? (
                    <div className={`grid ${gridDensity === 1 ? 'grid-cols-1' :
                        gridDensity === 2 ? 'grid-cols-2' :
                            'grid-cols-3'
                        } md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4 lg:gap-8 min-h-[400px]`}>
                        {filteredRecipes.map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-24 bg-white mx-4 rounded-[3rem] border border-gray-100 shadow-sm"
                    >
                        <div className="mb-6 inline-flex p-8 bg-gray-50 rounded-full text-gray-400">
                            <Frown size={64} />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-2">No recipes found</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto font-medium px-4">
                            We couldn't find any recipes matching your search criteria. Try adjusting your filters or search terms.
                        </p>
                        <button
                            onClick={() => {
                                setLocalQuery('');
                                setSearchParams({});
                                setSelectedIngredients([]);
                                setSelectedCategories([]);
                            }}
                            className="inline-flex items-center justify-center px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-xl active:scale-95"
                        >
                            Clear All Filters
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
