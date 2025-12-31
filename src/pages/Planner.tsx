import { useState } from 'react';
import { addDays, addWeeks, format, startOfWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe, PlannerMeal } from '@/lib/types';
import { Plus, Search, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ShoppingCart } from 'lucide-react';
import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { useMealPlanner } from '@/contexts/MealPlannerContext';
import { useRecipes } from '@/lib/hooks';
import { Link } from 'react-router-dom';

export default function Planner() {
    const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, +1 = next week
    const { addMultipleToCart } = useShoppingCart();
    const { plannedMeals, dailyNotes, addRecipeToDate, addCustomMealToDate, removeRecipeFromDate, saveDailyNote } = useMealPlanner();
    const { recipes, loading, error } = useRecipes();

    const today = new Date();
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

    const openSearch = (dateStr: string) => {
        setSearchDate(dateStr);
        setSearchQuery('');
        setIsSearchOpen(true);
    };

    const handleSearchAdd = (recipe: Recipe) => {
        if (searchDate) {
            addRecipeToDate(recipe, searchDate);
            setIsSearchOpen(false);
        }
    };

    const filteredRecipes = recipes.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tags.some(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
                itemsToBatch.push({
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
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold text-gray-900">Weekly Meal Planner</h1>
                    <button
                        onClick={addWeekToCart}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        <ShoppingCart size={18} />
                        Add Week to Cart
                    </button>
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

            <div className="w-full">
                {/* Calendar Grid (Drop targets) */}
                <div className="w-full">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                        {weekDays.map((day) => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const isToday = format(today, 'yyyy-MM-dd') === dateStr;
                            const meals = plannedMeals[dateStr] || [];

                            return (
                                <div
                                    key={dateStr}
                                    className={`min-h-[450px] bg-white rounded-[2rem] p-4 border-2 transition-all duration-300 flex flex-col relative overflow-hidden
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
                                        {meals.map((meal, idx) => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                key={`${meal.id}-${idx}`}
                                                className="group relative"
                                            >
                                                {meal.recipe ? (
                                                    <Link
                                                        to={`/recipe/${meal.id}`}
                                                        className="block bg-white p-2 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer"
                                                    >
                                                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-gray-100 mb-2 shadow-sm border border-gray-50">
                                                            {meal.image_url ? (
                                                                <img src={meal.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs font-bold">
                                                                    {meal.title.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="font-bold text-xs text-gray-900 leading-tight line-clamp-2 px-1 mb-1">{meal.title}</p>
                                                    </Link>
                                                ) : (
                                                    <div className="block bg-primary-50 p-4 rounded-2xl shadow-sm border border-primary-100 hover:shadow-md hover:border-primary-200 transition-all border-dashed">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                                                                <CalendarIcon size={14} />
                                                            </div>
                                                            <p className="font-bold text-sm text-primary-900 leading-tight line-clamp-2">{meal.title}</p>
                                                        </div>
                                                    </div>
                                                )}

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
                                        ))}

                                        {meals.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center py-10 opacity-20 group">
                                                <span className="text-4xl mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">🍽️</span>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-900">Empty</p>
                                            </div>
                                        )}
                                    </div>


                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <textarea
                                            placeholder="Notes..."
                                            className="w-full text-xs bg-gray-50 border-none rounded-xl p-3 min-h-[60px] resize-none focus:ring-1 focus:ring-primary-500 transition-all font-medium text-gray-600 placeholder:text-gray-300"
                                            value={dailyNotes[dateStr] || ''}
                                            onChange={(e) => saveDailyNote(dateStr, e.target.value)}
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
                        >
                            <div className="p-8 border-b border-gray-50 flex items-center gap-6 bg-gray-50/50">
                                <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                                    <Search size={28} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-1">Add to Planner</p>
                                    <input
                                        autoFocus
                                        type="text"
                                        className="w-full outline-none text-2xl font-bold placeholder-gray-300 bg-transparent"
                                        placeholder="Search your kitchen..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <button onClick={() => setIsSearchOpen(false)} className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                                {searchQuery.trim().length > 0 && (
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
        </div>
    );
}
