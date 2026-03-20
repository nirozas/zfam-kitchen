import { useState, useEffect, useRef, useMemo } from 'react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe, PlannerMeal } from '@/lib/types';
import { Plus, Search, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ShoppingCart, History, ExternalLink, CheckCircle2, Circle, StickyNote } from 'lucide-react';
import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { useMealPlanner } from '@/contexts/MealPlannerContext';
import { useRecipes } from '@/lib/hooks';
import { Link, useSearchParams } from 'react-router-dom';

const DebouncedInput = ({ value, onChange, placeholder, className, delay = 500 }: any) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: any) => {
        const newVal = e.target.value;
        setLocalValue(newVal);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onChange(newVal);
        }, delay);
    };

    return (
        <input
            type="text"
            placeholder={placeholder}
            className={className}
            value={localValue}
            onChange={handleChange}
        />
    );
};

const DebouncedTextArea = ({ value, onChange, placeholder, className, delay = 500, onTouchStart }: any) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleChange = (e: any) => {
        const newVal = e.target.value;
        setLocalValue(newVal);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onChange(newVal);
        }, delay);
    };

    return (
        <textarea
            placeholder={placeholder}
            className={className}
            value={localValue}
            onChange={handleChange}
            onTouchStart={onTouchStart}
        />
    );
};

export default function Planner() {
    const [searchParams, setSearchParams] = useSearchParams();
    const weekParam = searchParams.get('week');
    const today = new Date();

    const weekOffset = useMemo(() => {
        if (!weekParam) return 0;
        try {
            // Append T12:00:00 to avoid UTC parsing issues (which could shift the date to the previous day in some timezones)
            const target = startOfWeek(new Date(`${weekParam}T12:00:00`), { weekStartsOn: 1 });
            const current = startOfWeek(today, { weekStartsOn: 1 });
            return Math.round((target.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
        } catch (e) {
            return 0;
        }
    }, [weekParam, today]);

    const setWeekOffset = (newOffset: number | ((prev: number) => number)) => {
        const calculatedOffset = typeof newOffset === 'function' ? newOffset(weekOffset) : newOffset;
        const target = startOfWeek(addWeeks(today, calculatedOffset), { weekStartsOn: 1 });
        const dateStr = format(target, 'yyyy-MM-dd');
        setSearchParams(prev => {
            prev.set('week', dateStr);
            return prev;
        }, { replace: true });
    };

    const { addMultipleToCart } = useShoppingCart();
    const { plannedMeals, dailyNotes, addRecipeToDate, addCustomMealToDate, removeRecipeFromDate, assignRecipeToMeal, saveDailyNote, updateMealNote, toggleMealCompleted } = useMealPlanner();
    const { recipes, loading, error } = useRecipes();

    const [plannerSearchQuery, setPlannerSearchQuery] = useState('');
    const [assigningMealId, setAssigningMealId] = useState<number | string | null>(null);
    const [showAllOccurrences, setShowAllOccurrences] = useState(false);
    const [gridDensity, setGridDensity] = useState(1); // 1 = normal, 2 = compact

    const currentWeekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

    // const [draggedRecipe, setDraggedRecipe] = useState<Recipe | null>(null); // Disabled as sidebar is removed

    // Search Modal State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchDate, setSearchDate] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    /* 
    const handleDrop = (dateStr: string) => {
        if (draggedRecipe) {
            addRecipeToDate(draggedRecipe, dateStr);
            setDraggedRecipe(null);
        }
    };
    */

    const closeSearch = () => {
        setIsSearchOpen(false);
        setSearchDate(null);
        setAssigningMealId(null);
        setSearchQuery('');
    };

    const openSearch = (dateStr: string) => {
        setSearchDate(dateStr);
        setSearchQuery('');
        setIsSearchOpen(true);
    };

    const handleSearchAdd = (recipe: Recipe) => {
        if (assigningMealId) {
            assignRecipeToMeal(assigningMealId, recipe);
            setAssigningMealId(null);
            setIsSearchOpen(false);
        } else if (searchDate) {
            addRecipeToDate(recipe, searchDate);
            setIsSearchOpen(false);
        }
    };

    const openSearchForAssign = (mealId: number | string) => {
        setAssigningMealId(mealId);
        setSearchDate(null);
        setSearchQuery('');
        setIsSearchOpen(true);
    };

    const filteredRecipes = recipes.filter(r => {
        const q = searchQuery.toLowerCase();
        return (
            r.title.toLowerCase().includes(q) ||
            (r.alternative_titles || '').toLowerCase().includes(q) ||
            (r.notes || '').toLowerCase().includes(q) ||
            r.tags.some(t => t.name.toLowerCase().includes(q)) ||
            r.ingredients.some(i => 
                (i.ingredient?.name || '').toLowerCase().includes(q) || 
                (i.note || '').toLowerCase().includes(q)
            )
        );
    });

    const addWeekToCart = () => {
        const weekId = getWeekId(currentWeekStart);
        const allRecipesThisWeek = new Set<Recipe>();

        // Collect all unique recipes for this week
        weekDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const meals: PlannerMeal[] = plannedMeals[dateStr] || [];
            meals.forEach(meal => {
                if (meal.recipe) allRecipesThisWeek.add(meal.recipe);
            });
        });

        // Collect all items to add
        const itemsToBatch: any[] = [];
        allRecipesThisWeek.forEach(recipe => {
            recipe.ingredients.forEach(item => {
                item.ingredient && itemsToBatch.push({
                    name: item.ingredient.name,
                    amount: item.amount_in_grams,
                    unit: item.unit || 'g',
                    recipeId: recipe.id,
                    recipeName: recipe.title,
                    weekId: weekId,
                });
            });
        });

        if (itemsToBatch.length > 0) {
            addMultipleToCart(itemsToBatch);
        }
    };

    const navigateToDate = (dateStr: string) => {
        const targetDate = new Date(`${dateStr}T12:00:00`);
        const diffInDays = Math.floor((targetDate.getTime() - startOfWeek(today, { weekStartsOn: 1 }).getTime()) / (1000 * 60 * 60 * 24));
        const offset = Math.floor(diffInDays / 7);
        setWeekOffset(offset);
        setPlannerSearchQuery('');
    };

    // Global Planner Search Results
    const globalSearchResults = Array.from(new Set([...Object.keys(plannedMeals), ...Object.keys(dailyNotes)]))
        .flatMap(date => {
            const q = plannerSearchQuery.toLowerCase();
            if (!plannerSearchQuery) return [];

            const mealsMatching = (plannedMeals[date] || []).filter(m =>
                m.title.toLowerCase().includes(q) ||
                (m.note || '').toLowerCase().includes(q) ||
                (m.recipe?.alternative_titles || '').toLowerCase().includes(q) ||
                (m.recipe?.notes || '').toLowerCase().includes(q) ||
                (m.recipe?.category?.name || '').toLowerCase().includes(q) ||
                (m.recipe?.tags || []).some(t => t.name.toLowerCase().includes(q)) ||
                (m.recipe?.ingredients || []).some(i => 
                    (i.ingredient?.name || '').toLowerCase().includes(q) || 
                    (i.note || '').toLowerCase().includes(q)
                )
            ).map(m => ({ ...m, date }));

            const dayNoteMatch = (dailyNotes[date] || '').toLowerCase().includes(q);
            if (dayNoteMatch) {
                const noteResult = {
                    id: `note-${date}`,
                    title: `Plan Note: ${dailyNotes[date]}`,
                    date,
                    isNote: true,
                    image_url: undefined
                };
                // Prepend the note result
                return [noteResult, ...mealsMatching];
            }
            return mealsMatching;
        }).sort((a, b) => b.date.localeCompare(a.date));

    const weekEndDate = addDays(currentWeekStart, 6);
    const isCurrentWeek = weekOffset === 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading recipes...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Recipes</h2>
                    <p className="text-gray-700 mb-2">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-10 relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Week Navigation Header */}
            <div className="mb-8 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <h1 className="text-3xl font-bold text-gray-900">Weekly Meal Planner</h1>
                        <div className="relative group max-w-sm flex-1 hidden sm:block">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search in your plan..."
                                className="w-full pl-11 pr-10 py-2.5 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-sm shadow-sm"
                                value={plannerSearchQuery}
                                onChange={(e) => setPlannerSearchQuery(e.target.value)}
                            />
                            {plannerSearchQuery && (
                                <div className="absolute top-full left-0 w-[400px] mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[60] overflow-hidden max-h-[400px] flex flex-col">
                                    <div className="flex items-center justify-between p-3 border-b border-gray-50">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">History Results</span>
                                        <button
                                            onClick={() => setShowAllOccurrences(true)}
                                            className="text-[10px] font-black text-primary-600 uppercase hover:underline"
                                        >
                                            See All Occurrences
                                        </button>
                                    </div>
                                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                                        {globalSearchResults.slice(0, 10).map((result, i) => (
                                            <button
                                                key={`${result.date}-${i}`}
                                                onClick={() => navigateToDate(result.date)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                    {(result as any).isNote ? (
                                                       <StickyNote size={18} className="text-yellow-500 fill-yellow-50" />
                                                    ) : (
                                                       result.image_url ? <img src={result.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">{result.title.substring(0, 2)}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-bold text-xs text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors ${(result as any).isNote ? 'italic' : ''}`}>{result.title}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium">{format(new Date(result.date), 'MMM d, yyyy')}</p>
                                                </div>
                                                <ExternalLink size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                                            </button>
                                        ))}
                                        {globalSearchResults.length === 0 && (
                                            <div className="p-8 text-center">
                                                <p className="text-xs text-gray-400 italic">No historical matches</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {plannerSearchQuery && (
                                <button
                                    onClick={() => setPlannerSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={addWeekToCart}
                        className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2.5 rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 flex-shrink-0"
                    >
                        <ShoppingCart size={18} />
                        Add Week to Cart
                    </button>
                </div>

                {/* Mobile Search */}
                <div className="relative group sm:hidden">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search in your plan..."
                        className="w-full pl-11 pr-10 py-3 bg-white border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-sm shadow-sm"
                        value={plannerSearchQuery}
                        onChange={(e) => setPlannerSearchQuery(e.target.value)}
                    />
                    {plannerSearchQuery && (
                        <button
                            onClick={() => setPlannerSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <button
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                        Previous Week
                    </button>

                    <div className="flex items-center gap-3">
                        <CalendarIcon size={20} className="text-primary-600" />
                        <span className="font-semibold text-gray-900">
                            {format(currentWeekStart, 'MMM d')} - {format(weekEndDate, 'MMM d, yyyy')}
                        </span>
                        {!isCurrentWeek && (
                            <button
                                onClick={() => setWeekOffset(0)}
                                className="ml-4 px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                            >
                                Today
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Next Week
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="flex sm:hidden items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm self-start mb-6">
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
                        onClick={() => setGridDensity(prev => Math.min(2, prev + 1))}
                        disabled={gridDensity === 2}
                        className="p-2 bg-gray-50 rounded-xl disabled:opacity-30"
                    >
                        <X size={16} className="rotate-45" />
                    </button>
                </div>
            </div>

            <div className="w-full">
                {/* Calendar Grid (Drop targets) */}
                <div className="w-full">
                    <div className={`grid ${gridDensity === 1 ? 'grid-cols-1' : 'grid-cols-2'} sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4`}>
                        {weekDays.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isToday = format(today, 'yyyy-MM-dd') === dateStr;
                            const meals = plannedMeals[dateStr] || [];

                            return (
                                <div
                                    key={dateStr}
                                    className={`min-h-[350px] md:min-h-[450px] bg-white rounded-[2rem] p-4 border-2 transition-all duration-300 flex flex-col relative overflow-hidden
                    ${isToday ? 'border-primary-500 shadow-xl shadow-primary-100/50 scale-[1.02] z-10' : 'border-gray-50 hover:border-primary-100 hover:shadow-lg'}
                  `}
                                >
                                    {isToday && (
                                        <div className="absolute top-0 right-0 p-2">
                                            <span className="bg-primary-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Today</span>
                                        </div>
                                    )}

                                    <div className="text-center mb-6 pt-2">
                                        <span className={`block text-[11px] font-black uppercase tracking-[0.2em] mb-1 ${isToday ? 'text-primary-500' : 'text-gray-400'}`}>
                                            {format(day, 'EEE')}
                                        </span>
                                        <span className={`block text-2xl font-black ${isToday ? 'text-gray-900' : 'text-gray-900 opacity-80'}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>

                                    <div className="space-y-4 flex-1">
                                        {meals.map((meal, idx) => {
                                            const matchesSearch = !plannerSearchQuery ||
                                                meal.title.toLowerCase().includes(plannerSearchQuery.toLowerCase()) ||
                                                (meal.recipe?.category?.name || '').toLowerCase().includes(plannerSearchQuery.toLowerCase()) ||
                                                (meal.recipe?.tags || []).some(t => t.name.toLowerCase().includes(plannerSearchQuery.toLowerCase()));

                                            return (
                                                <motion.div
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{
                                                        opacity: matchesSearch ? 1 : 0.3,
                                                        scale: matchesSearch ? 1 : 0.95,
                                                        filter: matchesSearch ? 'none' : 'grayscale(0.5)'
                                                    }}
                                                    key={`${meal.id}-${idx}`}
                                                    className="group relative"
                                                >
                                                    {meal.recipe ? (
                                                        <div className="relative">
                                                            <Link
                                                                to={`/recipe/${meal.recipe.slug || meal.recipe.id}`}
                                                                className={`block bg-white p-2 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer ${meal.completed ? 'opacity-60 grayscale-[0.5]' : ''}`}
                                                            >
                                                                <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-100 mb-2 shadow-sm border border-gray-50 relative">
                                                                    {meal.image_url ? (
                                                                        <img src={meal.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                                                                            {meal.title.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMealCompleted(dateStr, idx); }}
                                                                        className={`absolute bottom-2 left-2 p-1.5 rounded-lg backdrop-blur-md transition-all shadow-lg ${meal.completed ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-400 hover:text-primary-600'}`}
                                                                    >
                                                                        {meal.completed ? <CheckCircle2 size={14} strokeWidth={3} /> : <Circle size={14} strokeWidth={3} />}
                                                                    </button>
                                                                </div>
                                                                <p className="font-bold text-xs text-gray-900 leading-tight line-clamp-2 px-1 mb-1">{meal.title}</p>
                                                            </Link>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between w-full pr-2">
                                                                <button
                                                                    onClick={() => toggleMealCompleted(dateStr, idx)}
                                                                    className={`mr-2 p-2 rounded-xl transition-all ${meal.completed ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:bg-gray-50'}`}
                                                                >
                                                                    {meal.completed ? <CheckCircle2 size={20} strokeWidth={3} /> : <Circle size={20} strokeWidth={3} />}
                                                                </button>
                                                                <Link
                                                                    to={`/create?title=${encodeURIComponent(meal.title)}`}
                                                                    className={`flex-1 block bg-primary-50 p-4 rounded-2xl shadow-sm border border-primary-100 hover:shadow-md hover:border-primary-200 transition-all border-dashed cursor-pointer group/custom ${meal.completed ? 'opacity-60' : ''}`}
                                                                    title="Create recipe from this entry"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                                                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 group-hover/custom:bg-primary-600 group-hover/custom:text-white transition-colors">
                                                                                <Plus size={14} />
                                                                            </div>
                                                                            <button
                                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openSearchForAssign(meal.id); }}
                                                                                className="w-8 h-8 rounded-lg bg-white border border-primary-100 flex items-center justify-center text-primary-400 hover:text-primary-600 hover:border-primary-300 transition-all"
                                                                                title="Assign an existing recipe"
                                                                            >
                                                                                <Search size={14} />
                                                                            </button>
                                                                        </div>
                                                                        <p className="font-bold text-sm text-primary-900 leading-tight line-clamp-3">{meal.title}</p>
                                                                    </div>
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Individual Meal Note */}
                                                    <div className="px-2 mt-2">
                                                        <DebouncedInput
                                                            placeholder="Personal note..."
                                                            className="w-full text-[10px] bg-transparent border-none p-0 focus:ring-0 text-gray-400 font-medium placeholder:text-gray-200 hover:text-gray-600 transition-colors"
                                                            value={meal.note || ''}
                                                            onChange={(newVal: string) => updateMealNote(dateStr, idx, newVal)}
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            removeRecipeFromDate(dateStr, idx);
                                                        }}
                                                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-full transition-all shadow-lg z-20"
                                                        title="Remove"
                                                    >
                                                        <X size={12} strokeWidth={4} />
                                                    </button>
                                                </motion.div>
                                            );
                                        })}

                                        {meals.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center py-10 opacity-20 group">
                                                <span className="text-4xl mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">🍽️</span>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-900">Empty</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <DebouncedTextArea
                                            placeholder="Notes..."
                                            className="w-full text-xs bg-gray-50 border-none rounded-xl p-3 min-h-[60px] resize-none focus:ring-1 focus:ring-primary-500 transition-all font-medium text-gray-600 placeholder:text-gray-300 relative z-10 touch-auto"
                                            value={dailyNotes[dateStr] || ''}
                                            onChange={(newVal: string) => saveDailyNote(dateStr, newVal)}
                                            onTouchStart={(e: any) => e.stopPropagation()} // Fix for mobile scroll/touch conflict
                                        />
                                    </div>

                                    <button
                                        onClick={() => openSearch(dateStr)}
                                        className="mt-4 w-full py-3 flex items-center justify-center text-primary-400 hover:text-primary-600 hover:bg-primary-50 rounded-2xl transition-all border-2 border-dashed border-gray-100 hover:border-primary-200 bg-gray-50/50"
                                    >
                                        <Plus size={24} strokeWidth={3} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Search Modal */}
            <AnimatePresence>
                {isSearchOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md cursor-pointer"
                        onClick={closeSearch}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 cursor-default"
                        >
                            <div className="p-8 border-b border-gray-50 flex items-center gap-6 bg-gray-50/50">
                                <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                                    <Search size={28} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-1">
                                        {assigningMealId ? 'Replace Entry' : 'Add to Planner'}
                                    </p>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="w-full outline-none text-2xl font-bold placeholder-gray-300 bg-transparent"
                                        placeholder={assigningMealId ? "Search for replacement..." : "Search your kitchen..."}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button onClick={closeSearch} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                                {searchQuery.trim().length > 0 && !assigningMealId && (
                                    <button
                                        onClick={() => {
                                            if (searchDate) {
                                                addCustomMealToDate(searchQuery, searchDate);
                                                setIsSearchOpen(false);
                                            }
                                        }}
                                        className="mb-8 w-full flex items-center gap-4 p-4 bg-primary-50 rounded-[1.5rem] border-2 border-dashed border-primary-200 hover:bg-primary-100 transition-all text-left"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-primary-600 shadow-sm border border-primary-100">
                                            <Plus size={28} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-1">Custom Entry</p>
                                            <h4 className="font-bold text-xl text-gray-900">Add "{searchQuery}"</h4>
                                        </div>
                                    </button>
                                )}

                                {filteredRecipes.length === 0 ? (
                                    <div className="text-center py-10">
                                        <span className="text-4xl mb-4 block">🔍</span>
                                        <h3 className="text-lg font-bold text-gray-900">No matching recipes</h3>
                                        <p className="text-sm text-gray-500 max-w-[200px] mx-auto mt-1">Add it as a custom entry above!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredRecipes.map(recipe => (
                                            <button
                                                key={recipe.id}
                                                onClick={() => handleSearchAdd(recipe)}
                                                className="group flex items-center gap-5 p-4 hover:bg-primary-50 rounded-[1.5rem] transition-all text-left border border-transparent hover:border-primary-100"
                                            >
                                                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm border border-white">
                                                    {recipe.image_url ? (
                                                        <img src={recipe.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-300">
                                                            {recipe.title.substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary-500 mb-1">{recipe.category?.name || 'Recipe'}</p>
                                                    <h4 className="font-bold text-xl text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-1">{recipe.title}</h4>
                                                    <p className="text-sm text-gray-500 mt-1 line-clamp-1 opacity-70 italic">{recipe.description}</p>
                                                </div>
                                                <div className="w-12 h-12 rounded-full border-2 border-primary-100 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all">
                                                    <Plus size={24} strokeWidth={3} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* All Occurrences Modal */}
            <AnimatePresence>
                {showAllOccurrences && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowAllOccurrences(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-8 border-b border-gray-50 bg-primary-50/30 flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                            <History size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">All Occurrences</h2>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-500">History Search for "{plannerSearchQuery}"</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowAllOccurrences(false)} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total</p>
                                        <p className="text-2xl font-black text-primary-600 leading-none">{globalSearchResults.length}</p>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col justify-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Per Year</p>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(
                                                globalSearchResults.reduce((acc, r) => {
                                                    const year = r.date.split('-')[0];
                                                    acc[year] = (acc[year] || 0) + 1;
                                                    return acc;
                                                }, {} as Record<string, number>)
                                            ).map(([year, count]) => (
                                                <span key={year} className="text-[11px] font-bold text-gray-700">
                                                    {year}: <span className="text-primary-600">{count}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white shadow-sm flex flex-col justify-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Top Months</p>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                            {Object.entries(
                                                globalSearchResults.reduce((acc, r) => {
                                                    const month = format(new Date(r.date), 'MMM yy');
                                                    acc[month] = (acc[month] || 0) + 1;
                                                    return acc;
                                                }, {} as Record<string, number>)
                                            )
                                            .sort((a, b) => b[1] - a[1])
                                            .slice(0, 3)
                                            .map(([month, count]) => (
                                                <span key={month} className="text-[11px] font-bold text-gray-700">
                                                    {month}: <span className="text-primary-600">{count}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/20">
                                <div className="grid grid-cols-1 gap-3">
                                    {globalSearchResults.map((result, i) => (
                                        <button
                                            key={`${result.date}-${i}`}
                                            onClick={() => { navigateToDate(result.date); setShowAllOccurrences(false); }}
                                            className="group flex items-center gap-5 p-4 bg-gray-50/50 hover:bg-primary-50 border border-gray-100 hover:border-primary-100 rounded-3xl transition-all text-left"
                                        >
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-sm border border-white flex-shrink-0 flex items-center justify-center">
                                                {(result as any).isNote ? (
                                                   <StickyNote size={24} className="text-yellow-500 fill-yellow-50" />
                                                ) : (
                                                   result.image_url ? <img src={result.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-200">{result.title.substring(0, 2)}</div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-black text-gray-900 group-hover:text-primary-700 transition-colors ${(result as any).isNote ? 'italic' : ''}`}>{result.title}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <CalendarIcon size={12} className="text-primary-500" />
                                                    <p className="text-xs font-bold text-gray-500">{format(new Date(result.date), 'EEEE, MMMM d, yyyy')}</p>
                                                </div>
                                            </div>
                                            <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-primary-500 group-hover:scale-110 transition-transform">
                                                <ChevronRight size={20} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {globalSearchResults.length === 0 && (
                                    <div className="text-center py-20 opacity-30">
                                        <History size={48} className="mx-auto mb-4" />
                                        <p className="font-black uppercase tracking-widest text-sm">No History Found</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
