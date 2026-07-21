import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { addDays, addWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe, PlannerMeal } from '@/lib/types';
import {
    Plus, Search, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    ShoppingCart, History, ExternalLink, CheckCircle2, Circle, StickyNote,
    PieChart, Sparkles, Shuffle, Copy, Star, Package, Utensils
} from 'lucide-react';
import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { useMealPlanner } from '@/contexts/MealPlannerContext';
import { useRecipes } from '@/lib/hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { PlannerStatsModal } from '@/components/PlannerStatsModal';
import { getStoreNameFromUrl } from '@/utils/stringUtils';
import toast from 'react-hot-toast';

// ── Day accent palette ────────────────────────────────────────────────────────
const DAY_ACCENTS = [
    { bg: 'from-amber-400 to-orange-400',   ring: 'ring-amber-200',   text: 'text-amber-600',   dot: 'bg-amber-400',   light: 'bg-amber-50',   border: 'border-amber-200' },
    { bg: 'from-rose-400 to-pink-400',      ring: 'ring-rose-200',    text: 'text-rose-600',    dot: 'bg-rose-400',    light: 'bg-rose-50',    border: 'border-rose-200' },
    { bg: 'from-emerald-400 to-teal-400',   ring: 'ring-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-400', light: 'bg-emerald-50', border: 'border-emerald-200' },
    { bg: 'from-violet-400 to-purple-400',  ring: 'ring-violet-200',  text: 'text-violet-600',  dot: 'bg-violet-400',  light: 'bg-violet-50',  border: 'border-violet-200' },
    { bg: 'from-sky-400 to-blue-400',       ring: 'ring-sky-200',     text: 'text-sky-600',     dot: 'bg-sky-400',     light: 'bg-sky-50',     border: 'border-sky-200' },
    { bg: 'from-orange-400 to-amber-400',   ring: 'ring-orange-200',  text: 'text-orange-600',  dot: 'bg-orange-400',  light: 'bg-orange-50',  border: 'border-orange-200' },
    { bg: 'from-red-400 to-rose-400',       ring: 'ring-red-200',     text: 'text-red-600',     dot: 'bg-red-400',     light: 'bg-red-50',     border: 'border-red-200' },
];

// ── Debounced input helpers ───────────────────────────────────────────────────
const DebouncedInput = ({ value, onChange, placeholder, className, delay = 500 }: any) => {
    const [local, setLocal] = useState(value);
    const timer = useRef<any>(null);
    useEffect(() => { setLocal(value); }, [value]);
    const handle = (e: any) => {
        const v = e.target.value; setLocal(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(v), delay);
    };
    return <input type="text" placeholder={placeholder} className={className} value={local} onChange={handle} />;
};

const DebouncedTextArea = ({ value, onChange, placeholder, className, delay = 500, onTouchStart }: any) => {
    const [local, setLocal] = useState(value || '');
    const timer = useRef<any>(null);
    useEffect(() => { setLocal(value || ''); }, [value]);
    const handle = (e: any) => {
        const v = e.target.value; setLocal(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(v), delay);
    };
    return <textarea placeholder={placeholder} className={className} value={local} onChange={handle} onTouchStart={onTouchStart} />;
};

// ── Star Rating Popover ───────────────────────────────────────────────────────
function StarRatingPopover({ meal, onRate, onClose }: { meal: PlannerMeal; onRate: (r: number) => void; onClose: () => void }) {
    const [hovered, setHovered] = useState(0);
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 6 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-3 flex flex-col items-center gap-2 min-w-max"
        >
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Rate this meal</p>
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => { onRate(star); onClose(); }}
                        className="p-1 transition-transform hover:scale-125"
                    >
                        <Star
                            size={22}
                            className={star <= (hovered || meal.rating || 0) ? 'text-amber-400' : 'text-gray-200'}
                            fill={star <= (hovered || meal.rating || 0) ? 'currentColor' : 'none'}
                            strokeWidth={2}
                        />
                    </button>
                ))}
            </div>
            <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-gray-600 font-semibold mt-0.5">Skip</button>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.06))' }} />
        </motion.div>
    );
}

// ── Copy Week Confirmation Modal ──────────────────────────────────────────────
function CopyWeekModal({ fromDates, toDates, plannedMeals, onConfirm, onClose }: {
    fromDates: string[]; toDates: string[]; plannedMeals: Record<string, PlannerMeal[]>;
    onConfirm: () => void; onClose: () => void;
}) {
    const preview = fromDates.map((fd, i) => ({
        day: format(new Date(`${toDates[i]}T12:00:00`), 'EEE, MMM d'),
        meals: (plannedMeals[fd] || []).map(m => m.title),
    })).filter(d => d.meals.length > 0);

    const totalMeals = preview.reduce((s, d) => s + d.meals.length, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
                <div className="p-7 bg-gradient-to-br from-violet-50 to-purple-50 border-b border-violet-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                        <Copy size={22} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Copy Previous Week</h2>
                        <p className="text-sm text-gray-500 font-medium mt-0.5">{totalMeals} meals will be copied to this week</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {preview.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Package size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="font-bold">The previous week has no meals to copy.</p>
                    </div>
                ) : (
                    <div className="p-5 space-y-2 max-h-72 overflow-y-auto">
                        {preview.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="text-xs font-black text-violet-600 w-20 flex-shrink-0 pt-0.5">{d.day}</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {d.meals.map((m, j) => (
                                        <span key={j} className="text-xs font-semibold bg-white border border-gray-100 px-2 py-0.5 rounded-lg text-gray-700 shadow-sm">{m}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-5 border-t border-gray-50 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={preview.length === 0}
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-black text-sm hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Copy {totalMeals} Meals
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// ── Main Planner Page ─────────────────────────────────────────────────────────
export default function Planner() {
    const [searchParams, setSearchParams] = useSearchParams();
    const weekParam = searchParams.get('week');
    const today = new Date();

    const weekOffset = useMemo(() => {
        if (!weekParam) return 0;
        try {
            const target = startOfWeek(new Date(`${weekParam}T12:00:00`), { weekStartsOn: 1 });
            const current = startOfWeek(today, { weekStartsOn: 1 });
            return Math.round((target.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
        } catch { return 0; }
    }, [weekParam]);

    const setWeekOffset = (newOffset: number | ((prev: number) => number)) => {
        const calc = typeof newOffset === 'function' ? newOffset(weekOffset) : newOffset;
        const target = startOfWeek(addWeeks(today, calc), { weekStartsOn: 1 });
        setSearchParams(prev => { prev.set('week', format(target, 'yyyy-MM-dd')); return prev; }, { replace: true });
    };

    const { cartItems, addMultipleToCart } = useShoppingCart();
    const {
        plannedMeals, dailyNotes, dailyExpenses,
        addRecipeToDate, addCustomMealToDate, removeRecipeFromDate, assignRecipeToMeal,
        saveDailyNote, saveDailyExpense, updateMealNote, toggleMealCompleted,
        moveRecipeToDate, copyWeekMeals, rateMeal,
    } = useMealPlanner();
    const { recipes, loading, error } = useRecipes();

    // ── UI state ────────────────────────────────────────────────────────────
    const [plannerSearchQuery, setPlannerSearchQuery] = useState('');
    const [showAllOccurrences, setShowAllOccurrences] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchDate, setSearchDate] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [assigningMealId, setAssigningMealId] = useState<number | string | null>(null);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

    // ── Drag-and-drop state ─────────────────────────────────────────────────
    const [dragSource, setDragSource] = useState<{ fromDate: string; mealIndex: number } | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);

    // ── Rating popover state ────────────────────────────────────────────────
    const [ratingFor, setRatingFor] = useState<{ meal: PlannerMeal; dateStr: string; idx: number } | null>(null);

    // ── Week computation ────────────────────────────────────────────────────
    const currentWeekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
    const prevWeekStart = subWeeks(currentWeekStart, 1);
    const weekEndDate = addDays(currentWeekStart, 6);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
    const prevWeekDays = Array.from({ length: 7 }, (_, i) => addDays(prevWeekStart, i));
    const isCurrentWeek = weekOffset === 0;

    // ── Hero stats ──────────────────────────────────────────────────────────
    const totalMealsThisWeek = weekDays.reduce((a, d) => a + (plannedMeals[format(d, 'yyyy-MM-dd')] || []).length, 0);
    const plannedDaysCount = weekDays.filter(d => (plannedMeals[format(d, 'yyyy-MM-dd')] || []).length > 0).length;
    const completedMealsCount = weekDays.reduce((a, d) => {
        const ds = format(d, 'yyyy-MM-dd');
        return a + (plannedMeals[ds] || []).filter(m => m.completed).length;
    }, 0);

    // ── Smart ingredient counter ────────────────────────────────────────────
    const weekIngredientStats = useMemo(() => {
        const ingredientNames = new Set<string>();
        let totalKcal = 0;
        weekDays.forEach(day => {
            const ds = format(day, 'yyyy-MM-dd');
            (plannedMeals[ds] || []).forEach(meal => {
                if (meal.recipe?.ingredients) {
                    meal.recipe.ingredients.forEach(ing => {
                        ingredientNames.add(ing.ingredient?.name || '');
                        totalKcal += Math.round((ing.amount_in_grams || 0) * ((ing.ingredient as any)?.calories_per_100g || 0) / 100);
                    });
                }
            });
        });
        return { ingredientCount: ingredientNames.size, totalKcal };
    }, [plannedMeals, weekDays]);

    // ── Grocery progress per day ────────────────────────────────────────────
    const currentWeekId = getWeekId(currentWeekStart);
    const cartIngredientNames = useMemo(() => {
        return new Set(
            cartItems
                .filter((item: any) => item.weekId === currentWeekId)
                .map((item: any) => (item.name || '').toLowerCase())
        );
    }, [cartItems, currentWeekId]);

    const getDayCartProgress = useCallback((dateStr: string) => {
        const meals = plannedMeals[dateStr] || [];
        const allIngredients: string[] = [];
        meals.forEach(meal => {
            if (meal.recipe?.ingredients) {
                meal.recipe.ingredients.forEach(ing => {
                    if (ing.ingredient?.name) allIngredients.push(ing.ingredient.name.toLowerCase());
                });
            }
        });
        if (allIngredients.length === 0) return null;
        const inCart = allIngredients.filter(n => cartIngredientNames.has(n)).length;
        return { inCart, total: allIngredients.length, pct: Math.round((inCart / allIngredients.length) * 100) };
    }, [plannedMeals, cartIngredientNames]);

    // ── Search helpers ──────────────────────────────────────────────────────
    const closeSearch = () => { setIsSearchOpen(false); setSearchDate(null); setAssigningMealId(null); setSearchQuery(''); };
    const openSearch = (dateStr: string) => { setSearchDate(dateStr); setSearchQuery(''); setIsSearchOpen(true); };
    const openSearchForAssign = (mealId: number | string) => { setAssigningMealId(mealId); setSearchDate(null); setSearchQuery(''); setIsSearchOpen(true); };

    const handleSearchAdd = (recipe: Recipe) => {
        if (assigningMealId) { assignRecipeToMeal(assigningMealId, recipe); setAssigningMealId(null); }
        else if (searchDate) addRecipeToDate(recipe, searchDate);
        setIsSearchOpen(false);
    };

    const filteredRecipes = recipes.filter(r => {
        const q = searchQuery.toLowerCase();
        return r.title.toLowerCase().includes(q) ||
            (r.alternative_titles || '').toLowerCase().includes(q) ||
            (r.notes || '').toLowerCase().includes(q) ||
            r.tags.some(t => t.name.toLowerCase().includes(q)) ||
            r.ingredients.some(i => (i.ingredient?.name || '').toLowerCase().includes(q) || (i.note || '').toLowerCase().includes(q));
    });

    const getSurpriseRecipe = (dateStr: string) => {
        const usedIds = new Set(Object.values(plannedMeals).flat().map(m => m.recipe?.id).filter(Boolean));
        const pool = recipes.filter(r => !usedIds.has(r.id));
        const pick = (pool.length > 0 ? pool : recipes)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : recipes.length))];
        if (pick) addRecipeToDate(pick, dateStr);
    };

    // ── Add week to cart ────────────────────────────────────────────────────
    const addWeekToCart = () => {
        const weekId = getWeekId(currentWeekStart);
        const allRecipes = new Set<Recipe>();
        weekDays.forEach(day => {
            (plannedMeals[format(day, 'yyyy-MM-dd')] || []).forEach(m => { if (m.recipe) allRecipes.add(m.recipe); });
        });
        const items: any[] = [];
        allRecipes.forEach(recipe => {
            recipe.ingredients.forEach(item => {
                const autoStore = getStoreNameFromUrl(item.ingredient.purchase_url);
                item.ingredient && items.push({
                    name: item.ingredient.name, amount: item.amount_in_grams, unit: item.unit || 'g',
                    recipeId: recipe.id, recipeName: recipe.title, weekId,
                    purchaseUrl: item.ingredient.purchase_url || undefined,
                    storeName: autoStore || undefined
                });
            });
        });
        if (items.length > 0) addMultipleToCart(items);
    };

    // ── Copy previous week handler ──────────────────────────────────────────
    const handleCopyWeek = async () => {
        const fromDates = prevWeekDays.map(d => format(d, 'yyyy-MM-dd'));
        const toDates = weekDays.map(d => format(d, 'yyyy-MM-dd'));
        const count = await copyWeekMeals(fromDates, toDates);
        setIsCopyModalOpen(false);
        if (count > 0) toast.success(`${count} meals copied to this week! 🎉`);
        else toast.error('No meals found in the previous week.');
    };

    // ── Drag handlers ───────────────────────────────────────────────────────
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, fromDate: string, mealIndex: number) => {
        setDragSource({ fromDate, mealIndex });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ fromDate, mealIndex }));
    };

    const handleDragOver = (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverDate(dateStr);
    };

    const handleDrop = (e: React.DragEvent, toDate: string) => {
        e.preventDefault();
        setDragOverDate(null);
        if (!dragSource || dragSource.fromDate === toDate) { setDragSource(null); return; }
        moveRecipeToDate(dragSource.fromDate, dragSource.mealIndex, toDate);
        setDragSource(null);
        toast.success('Meal moved!', { icon: '📅', duration: 1500 });
    };

    const handleDragEnd = () => { setDragSource(null); setDragOverDate(null); };

    // ── Completion with rating prompt ───────────────────────────────────────
    const handleToggleComplete = async (dateStr: string, idx: number) => {
        const meal = (plannedMeals[dateStr] || [])[idx];
        const wasCompleted = meal?.completed;
        await toggleMealCompleted(dateStr, idx);
        // Show rating popover when marking AS complete (not un-completing)
        if (!wasCompleted && meal) {
            setRatingFor({ meal, dateStr, idx });
            setTimeout(() => setRatingFor(null), 8000);
        }
    };

    // ── Global search results ───────────────────────────────────────────────
    const navigateToDate = (dateStr: string) => {
        const target = new Date(`${dateStr}T12:00:00`);
        const diff = Math.floor((target.getTime() - startOfWeek(today, { weekStartsOn: 1 }).getTime()) / (1000 * 60 * 60 * 24));
        setWeekOffset(Math.floor(diff / 7));
        setPlannerSearchQuery('');
    };

    const globalSearchResults = useMemo(() => {
        if (!plannerSearchQuery) return [];
        const q = plannerSearchQuery.toLowerCase();
        return Array.from(new Set([...Object.keys(plannedMeals), ...Object.keys(dailyNotes)]))
            .flatMap(date => {
                const mealsMatching = (plannedMeals[date] || []).filter(m =>
                    m.title.toLowerCase().includes(q) ||
                    (m.note || '').toLowerCase().includes(q) ||
                    (m.recipe?.tags || []).some(t => t.name.toLowerCase().includes(q)) ||
                    (m.recipe?.ingredients || []).some(i => (i.ingredient?.name || '').toLowerCase().includes(q))
                ).map(m => ({ ...m, date }));
                const noteMatch = (dailyNotes[date] || '').toLowerCase().includes(q);
                if (noteMatch) return [{ id: `note-${date}`, title: `Note: ${dailyNotes[date]}`, date, isNote: true, image_url: undefined }, ...mealsMatching];
                return mealsMatching;
            }).sort((a, b) => b.date.localeCompare(a.date));
    }, [plannerSearchQuery, plannedMeals, dailyNotes]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-rose-50">
            <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin mx-auto mb-5" />
                <p className="text-gray-500 font-semibold">Loading your kitchen…</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Recipes</h2>
                <p className="text-gray-700 mb-2">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Retry</button>
            </div>
        </div>
    );

    return (
        <div className="pb-16 relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">

            {/* ── HERO HEADER ─────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[2.5rem] mb-5 mt-6 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 shadow-2xl shadow-orange-200/60">
                <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />

                <div className="relative z-10 px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <p className="text-white/70 text-[11px] font-black uppercase tracking-[0.3em] mb-2">Weekly Meal Planner</p>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
                            {format(currentWeekStart, 'MMM d')}
                            <span className="text-white/60 font-light"> — </span>
                            {format(weekEndDate, 'MMM d, yyyy')}
                        </h1>
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <span className="text-white/80 text-sm font-semibold">{plannedDaysCount}/7 days planned</span>
                            <span className="w-1 h-1 rounded-full bg-white/40" />
                            <span className="text-white/80 text-sm font-semibold">{totalMealsThisWeek} {totalMealsThisWeek === 1 ? 'meal' : 'meals'}</span>
                            {completedMealsCount > 0 && (<>
                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                <span className="text-white/80 text-sm font-semibold">✓ {completedMealsCount} cooked</span>
                            </>)}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Global search */}
                        <form onSubmit={e => { e.preventDefault(); (e.target as any).querySelector('input')?.blur(); }} className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 group-focus-within:text-white transition-colors" size={16} />
                            <input
                                type="text" placeholder="Search your plan…"
                                className="pl-10 pr-10 py-2.5 bg-white/20 border border-white/30 rounded-2xl focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all text-white placeholder-white/50 font-medium text-sm backdrop-blur-sm w-48"
                                value={plannerSearchQuery} onChange={e => setPlannerSearchQuery(e.target.value)}
                            />
                            {plannerSearchQuery && <button onClick={() => setPlannerSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"><X size={14} /></button>}
                        </form>

                        <button onClick={() => setIsCopyModalOpen(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm" title="Copy meals from last week">
                            <Copy size={16} />
                            <span className="hidden sm:inline">Copy Week</span>
                        </button>
                        <button onClick={() => setIsStatsOpen(true)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm">
                            <PieChart size={16} />
                            <span className="hidden sm:inline">Stats</span>
                        </button>
                        <button onClick={addWeekToCart} className="flex items-center gap-2 bg-white text-orange-500 px-5 py-2.5 rounded-2xl font-black text-sm hover:bg-orange-50 transition-all shadow-lg shadow-black/10">
                            <ShoppingCart size={16} />
                            <span>Add to Cart</span>
                        </button>
                    </div>
                </div>

                {/* Global search dropdown */}
                {plannerSearchQuery && (
                    <div className="absolute top-full left-6 right-6 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[60] overflow-hidden max-h-[350px] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">History</span>
                            <button onClick={() => setShowAllOccurrences(true)} className="text-[10px] font-black text-primary-600 uppercase hover:underline">See All</button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {globalSearchResults.slice(0, 8).map((r, i) => (
                                <button key={`${r.date}-${i}`} onClick={() => navigateToDate(r.date)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left group">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        {(r as any).isNote ? <StickyNote size={18} className="text-yellow-500" /> : r.image_url ? <img src={r.image_url} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-300">{r.title.substring(0, 2)}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-xs text-gray-900 line-clamp-1 group-hover:text-primary-600">{r.title}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">{format(new Date(r.date), 'MMM d, yyyy')}</p>
                                    </div>
                                    <ExternalLink size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                                </button>
                            ))}
                            {globalSearchResults.length === 0 && <div className="p-8 text-center"><p className="text-xs text-gray-400 italic">No historical matches</p></div>}
                        </div>
                    </div>
                )}
            </div>

            {/* ── SMART INGREDIENT COUNTER STRIP ──────────────────────────── */}
            {totalMealsThisWeek > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-3 mb-4 shadow-sm flex-wrap"
                >
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><Utensils size={14} className="text-emerald-600" /></div>
                        <span><span className="font-black text-gray-900">{weekIngredientStats.ingredientCount}</span> ingredients this week</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center"><span className="text-base leading-none">🔥</span></div>
                        <span><span className="font-black text-gray-900">{weekIngredientStats.totalKcal.toLocaleString()}</span> kcal planned</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center"><ShoppingCart size={14} className="text-primary-600" /></div>
                        <span>
                            <span className="font-black text-gray-900">{cartIngredientNames.size}</span>
                            <span className="text-gray-400"> / {weekIngredientStats.ingredientCount} in cart</span>
                        </span>
                    </div>
                    <button onClick={addWeekToCart} className="ml-auto text-xs font-black text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1">
                        Fill cart <ChevronRight size={14} />
                    </button>
                </motion.div>
            )}

            {/* ── WEEK NAV ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-6 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                <button onClick={() => setWeekOffset(p => p - 1)} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-semibold text-sm">
                    <ChevronLeft size={18} /><span className="hidden sm:inline">Previous</span>
                </button>
                <div className="flex items-center gap-3">
                    <CalendarIcon size={18} className="text-primary-500" />
                    <span className="font-bold text-gray-900 text-sm">{format(currentWeekStart, 'MMM d')} – {format(weekEndDate, 'MMM d, yyyy')}</span>
                    {!isCurrentWeek && (
                        <button onClick={() => setWeekOffset(0)} className="px-3 py-1 text-xs font-black bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors uppercase tracking-tight">Today</button>
                    )}
                </div>
                <button onClick={() => setWeekOffset(p => p + 1)} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-semibold text-sm">
                    <span className="hidden sm:inline">Next</span><ChevronRight size={18} />
                </button>
            </div>

            {/* ── DRAG HINT ───────────────────────────────────────────────── */}
            {dragSource && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-2xl z-50 pointer-events-none">
                    📅 Drop on another day to move this meal
                </motion.div>
            )}

            {/* ── CALENDAR GRID ───────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isToday = format(today, 'yyyy-MM-dd') === dateStr;
                    const isWeekend = dayIndex >= 5;
                    const meals = plannedMeals[dateStr] || [];
                    const accent = DAY_ACCENTS[dayIndex];
                    const isDragOver = dragOverDate === dateStr;
                    const cartProgress = getDayCartProgress(dateStr);

                    return (
                        <motion.div
                            key={dateStr}
                            layout
                            onDragOver={e => handleDragOver(e, dateStr)}
                            onDrop={e => handleDrop(e, dateStr)}
                            onDragLeave={() => setDragOverDate(null)}
                            className={`
                                min-h-[400px] md:min-h-[520px] rounded-[2rem] flex flex-col relative overflow-hidden
                                transition-all duration-200
                                ${isToday ? 'shadow-2xl shadow-orange-200/60 ring-2 ring-orange-300 z-10' : 'shadow-sm hover:shadow-lg border border-gray-100'}
                                ${isWeekend ? 'bg-amber-50/50' : 'bg-white'}
                                ${isDragOver ? `ring-2 ${accent.border} shadow-lg scale-[1.02]` : ''}
                            `}
                        >
                            {/* Accent bar */}
                            <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bg} flex-shrink-0`} />

                            {/* Grocery progress bar */}
                            {cartProgress && (
                                <div className="px-4 pt-2 pb-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">In Cart</span>
                                        <span className={`text-[9px] font-black ${cartProgress.pct === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>{cartProgress.inCart}/{cartProgress.total}</span>
                                    </div>
                                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full bg-gradient-to-r ${accent.bg} rounded-full`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${cartProgress.pct}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Today glow */}
                            {isToday && <div className="absolute inset-0 bg-gradient-to-b from-orange-50/80 to-transparent pointer-events-none z-0" />}

                            <div className="relative z-10 flex flex-col flex-1 p-4">
                                {/* Day header */}
                                <div className="flex items-start justify-between mb-4 pt-1">
                                    <div>
                                        <span className={`block text-[10px] font-black uppercase tracking-[0.25em] mb-0.5 ${isToday ? accent.text : 'text-gray-400'}`}>{format(day, 'EEE')}</span>
                                        <span className={`block text-3xl font-black leading-none tracking-tight ${isToday ? 'text-gray-900' : 'text-gray-700'}`}>{format(day, 'd')}</span>
                                        <span className={`text-[10px] font-semibold ${isToday ? 'text-gray-500' : 'text-gray-300'}`}>{format(day, 'MMM')}</span>
                                    </div>
                                    {isToday && (
                                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-gradient-to-r ${accent.bg} text-white shadow-sm`}>Today</span>
                                    )}
                                </div>

                                {/* Drag-over drop zone indicator */}
                                {isDragOver && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className={`mb-3 py-3 rounded-2xl border-2 border-dashed ${accent.border} ${accent.light} flex items-center justify-center gap-2 ${accent.text}`}
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                        <span className="text-xs font-black">Drop here</span>
                                    </motion.div>
                                )}

                                {/* Meals */}
                                <div className="space-y-3 flex-1">
                                    {meals.map((meal, idx) => {
                                        const matchesSearch = !plannerSearchQuery ||
                                            meal.title.toLowerCase().includes(plannerSearchQuery.toLowerCase()) ||
                                            (meal.recipe?.tags || []).some(t => t.name.toLowerCase().includes(plannerSearchQuery.toLowerCase()));
                                        const isDragging = dragSource?.fromDate === dateStr && dragSource.mealIndex === idx;
                                        const isRatingActive = ratingFor?.dateStr === dateStr && ratingFor.idx === idx;

                                        return (
                                            <div
                                                key={`drag-${meal.id}-${idx}`}
                                                draggable
                                                onDragStart={e => handleDragStart(e, dateStr, idx)}
                                                onDragEnd={handleDragEnd}
                                                style={{ cursor: 'grab' }}
                                            >
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                                animate={{
                                                    opacity: isDragging ? 0.4 : (matchesSearch ? 1 : 0.25),
                                                    y: 0,
                                                    scale: isDragging ? 0.95 : (matchesSearch ? 1 : 0.97),
                                                    rotate: isDragging ? 1 : 0,
                                                }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="group relative"
                                            >
                                                {meal.recipe ? (
                                                    <div className="relative">
                                                        <Link
                                                            to={`/recipe/${meal.recipe.slug || meal.recipe.id}`}
                                                            className={`block rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100/80 ${meal.completed ? 'opacity-50' : ''}`}
                                                            draggable={false}
                                                        >
                                                            <div className="relative h-28 w-full bg-gray-100">
                                                                {meal.image_url ? (
                                                                    <img src={meal.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="" />
                                                                ) : (
                                                                    <div className={`w-full h-full flex items-center justify-center ${accent.light}`}><span className="text-4xl opacity-30">🍽️</span></div>
                                                                )}
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                                                <p className="absolute bottom-2 left-2 right-8 text-white font-bold text-[11px] leading-tight line-clamp-2 drop-shadow-sm">{meal.title}</p>

                                                                {/* Category + rating badge */}
                                                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                                                    {meal.recipe?.category?.name && (
                                                                        <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/90 ${accent.text}`}>
                                                                            {meal.recipe.category.name}
                                                                        </span>
                                                                    )}
                                                                    {meal.rating && (
                                                                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-white flex items-center gap-0.5">
                                                                            {'★'.repeat(meal.rating)}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Complete button */}
                                                                <button
                                                                    onClick={e => { e.preventDefault(); e.stopPropagation(); handleToggleComplete(dateStr, idx); }}
                                                                    className={`absolute bottom-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all shadow-lg ${meal.completed ? 'bg-emerald-500 text-white' : 'bg-white/80 text-gray-400 hover:text-emerald-500'}`}
                                                                >
                                                                    {meal.completed ? <CheckCircle2 size={13} strokeWidth={3} /> : <Circle size={13} strokeWidth={3} />}
                                                                </button>
                                                            </div>
                                                        </Link>

                                                        {/* Completion overlay */}
                                                        {meal.completed && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="bg-emerald-500/20 backdrop-blur-[2px] rounded-2xl inset-0 absolute" />
                                                                <CheckCircle2 size={28} className="text-emerald-500 relative z-10" strokeWidth={2.5} />
                                                            </div>
                                                        )}

                                                        {/* ★ RATING POPOVER */}
                                                        <AnimatePresence>
                                                            {isRatingActive && (
                                                                <StarRatingPopover
                                                                    meal={meal}
                                                                    onRate={r => rateMeal(meal.id, r)}
                                                                    onClose={() => setRatingFor(null)}
                                                                />
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start gap-2">
                                                        <button
                                                            onClick={() => handleToggleComplete(dateStr, idx)}
                                                            className={`mt-1 flex-shrink-0 p-1.5 rounded-xl transition-all ${meal.completed ? 'text-emerald-500 bg-emerald-50' : 'text-gray-300 hover:bg-gray-50'}`}
                                                        >
                                                            {meal.completed ? <CheckCircle2 size={18} strokeWidth={3} /> : <Circle size={18} strokeWidth={3} />}
                                                        </button>
                                                        <Link
                                                            to={`/create?title=${encodeURIComponent(meal.title)}&mealId=${meal.id}&date=${dateStr}`}
                                                            draggable={false}
                                                            className={`flex-1 block p-3 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${accent.light} border-current ${accent.text} hover:shadow-sm ${meal.completed ? 'opacity-50' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${accent.bg} flex items-center justify-center text-white flex-shrink-0`}><Plus size={12} strokeWidth={3} /></div>
                                                                <p className={`font-bold text-xs leading-tight line-clamp-2 ${accent.text}`}>{meal.title}</p>
                                                            </div>
                                                        </Link>
                                                        <button onClick={() => openSearchForAssign(meal.id)} className="mt-1 flex-shrink-0 p-1.5 rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-primary-500 hover:border-primary-200 transition-all">
                                                            <Search size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Meal note */}
                                                <div className="px-1 mt-1.5">
                                                    <DebouncedInput
                                                        placeholder="Personal note…"
                                                        className="w-full text-[10px] bg-transparent border-none p-0 focus:ring-0 text-gray-400 font-medium placeholder:text-gray-200 hover:text-gray-600 transition-colors"
                                                        value={meal.note || ''}
                                                        onChange={(v: string) => updateMealNote(dateStr, idx, v)}
                                                    />
                                                </div>

                                                {/* Delete */}
                                                <button
                                                    onClick={e => { e.preventDefault(); e.stopPropagation(); removeRecipeFromDate(dateStr, idx); }}
                                                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1.5 text-white bg-red-500 hover:bg-red-600 rounded-full transition-all shadow-lg z-20"
                                                >
                                                    <X size={11} strokeWidth={4} />
                                                </button>
                                            </motion.div>
                                            </div>
                                        );
                                    })}

                                    {/* Empty state */}
                                    {meals.length === 0 && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className={`group flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed transition-all cursor-default ${isDragOver ? `${accent.border} ${accent.light}` : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <span className="text-3xl mb-2 grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500">🍽️</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 group-hover:text-gray-400">Empty</p>
                                            <button
                                                onClick={() => getSurpriseRecipe(dateStr)}
                                                className={`mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all px-3 py-1.5 rounded-xl ${accent.light} ${accent.text}`}
                                            >
                                                <Shuffle size={11} />Surprise me
                                            </button>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Notes + Expense + Add */}
                                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
                                    <div className="relative">
                                        <DebouncedTextArea
                                            placeholder="Notes for the day…"
                                            className="w-full text-xs bg-amber-50 border border-amber-100 rounded-xl p-3 min-h-[52px] resize-none focus:ring-1 focus:ring-amber-300 transition-all font-medium text-amber-900 placeholder:text-amber-300 touch-auto"
                                            value={dailyNotes[dateStr] || ''}
                                            onChange={(v: string) => saveDailyNote(dateStr, v)}
                                            onTouchStart={(e: any) => e.stopPropagation()}
                                        />
                                        <StickyNote size={12} className="absolute top-2.5 right-2.5 text-amber-300 pointer-events-none" />
                                    </div>

                                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex-shrink-0">$</span>
                                        <input
                                            type="number" min="0" step="0.01"
                                            className="w-16 text-xs bg-white border border-gray-100 rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary-400 font-bold"
                                            value={dailyExpenses[dateStr]?.expense_amount || ''}
                                            onChange={e => saveDailyExpense(dateStr, parseFloat(e.target.value) || 0, dailyExpenses[dateStr]?.is_restaurant || false, dailyExpenses[dateStr]?.restaurant_name || '')}
                                            placeholder="0.00"
                                        />
                                        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                                            <input type="checkbox" className="rounded text-primary-500 h-3.5 w-3.5 border-gray-300"
                                                checked={dailyExpenses[dateStr]?.is_restaurant || false}
                                                onChange={e => saveDailyExpense(dateStr, dailyExpenses[dateStr]?.expense_amount || 0, e.target.checked, dailyExpenses[dateStr]?.restaurant_name || '')}
                                            />
                                            <span className="text-[10px] font-bold text-gray-400">🍜 Rest.</span>
                                        </label>
                                    </div>

                                    {dailyExpenses[dateStr]?.is_restaurant && (
                                        <DebouncedInput
                                            placeholder="Restaurant name…"
                                            className="w-full text-xs bg-white border border-gray-100 rounded-xl px-3 py-2 focus:ring-1 focus:ring-primary-400"
                                            value={dailyExpenses[dateStr]?.restaurant_name || ''}
                                            onChange={(v: string) => saveDailyExpense(dateStr, dailyExpenses[dateStr]?.expense_amount || 0, true, v)}
                                        />
                                    )}

                                    <motion.button
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => openSearch(dateStr)}
                                        className={`w-full py-3 flex items-center justify-center gap-2 rounded-2xl transition-all border-2 border-dashed text-sm font-bold ${accent.text} ${accent.light} border-current/30 hover:border-current/60 hover:shadow-sm`}
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                        <span className="text-[11px] uppercase tracking-wider font-black">Add Meal</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── SEARCH MODAL ───────────────────────────────────────────── */}
            <AnimatePresence>
                {isSearchOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md cursor-pointer" onClick={closeSearch}>
                        <motion.div
                            initial={{ opacity: 0, y: 40, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 40, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 cursor-default"
                        >
                            <div className="p-7 border-b border-gray-50 flex items-center gap-5 bg-gradient-to-br from-primary-50 to-rose-50">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-rose-500 flex items-center justify-center text-white shadow-lg flex-shrink-0"><Search size={22} /></div>
                                <form className="flex-1" onSubmit={e => { e.preventDefault(); if (searchQuery.trim() && !assigningMealId && searchDate) { addCustomMealToDate(searchQuery, searchDate); setIsSearchOpen(false); } }}>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600 mb-1">{assigningMealId ? 'Replace Entry' : 'Add to Planner'}</p>
                                    <input autoFocus type="text" className="w-full outline-none text-2xl font-black placeholder-gray-300 bg-transparent text-gray-900"
                                        placeholder={assigningMealId ? 'Search for replacement…' : 'Search your kitchen…'}
                                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </form>
                                <button onClick={closeSearch} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><X size={22} /></button>
                            </div>

                            <div className="overflow-y-auto p-5 flex-1 custom-scrollbar">
                                {searchQuery.trim() && !assigningMealId && (
                                    <button onClick={() => { if (searchDate) { addCustomMealToDate(searchQuery, searchDate); setIsSearchOpen(false); } }} className="mb-6 w-full flex items-center gap-4 p-4 bg-primary-50 rounded-2xl border-2 border-dashed border-primary-200 hover:bg-primary-100 transition-all text-left">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-rose-500 flex items-center justify-center text-white shadow-md flex-shrink-0"><Sparkles size={22} /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-0.5">Custom Entry</p>
                                            <h4 className="font-black text-lg text-gray-900">Add "{searchQuery}"</h4>
                                        </div>
                                    </button>
                                )}
                                {filteredRecipes.length === 0 ? (
                                    <div className="text-center py-12"><span className="text-5xl mb-4 block">🔍</span><h3 className="text-lg font-black text-gray-900 mb-1">No matching recipes</h3><p className="text-sm text-gray-400">Add it as a custom entry above!</p></div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-2">
                                        {filteredRecipes.map(recipe => (
                                            <button key={recipe.id} onClick={() => handleSearchAdd(recipe)} className="group flex items-center gap-4 p-3 hover:bg-primary-50 rounded-2xl transition-all text-left border border-transparent hover:border-primary-100">
                                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm">
                                                    {recipe.image_url ? <img src={recipe.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-300">{recipe.title.substring(0, 2).toUpperCase()}</div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary-500 mb-0.5">{recipe.category?.name || 'Recipe'}</p>
                                                    <h4 className="font-black text-base text-gray-900 group-hover:text-primary-700 transition-colors line-clamp-1">{recipe.title}</h4>
                                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{recipe.description}</p>
                                                </div>
                                                <div className="w-10 h-10 rounded-full border-2 border-primary-100 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all flex-shrink-0">
                                                    <Plus size={20} strokeWidth={3} />
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

            {/* ── ALL OCCURRENCES MODAL ─────────────────────────────────── */}
            <AnimatePresence>
                {showAllOccurrences && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowAllOccurrences(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-8 border-b border-gray-50 bg-primary-50/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600"><History size={24} /></div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900">All Occurrences</h2>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-500">History for "{plannerSearchQuery}"</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAllOccurrences(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><X size={22} /></button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 gap-2">
                                    {globalSearchResults.map((r, i) => (
                                        <button key={`${r.date}-${i}`} onClick={() => { navigateToDate(r.date); setShowAllOccurrences(false); }}
                                            className="group flex items-center gap-4 p-3 bg-white hover:bg-primary-50 border border-gray-100 hover:border-primary-100 rounded-2xl transition-all text-left">
                                            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-50 shadow-sm border border-white flex-shrink-0 flex items-center justify-center">
                                                {(r as any).isNote ? <StickyNote size={24} className="text-yellow-500" /> : r.image_url ? <img src={r.image_url} className="w-full h-full object-cover" /> : <div className="font-bold text-gray-200">{r.title.substring(0, 2)}</div>}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-black text-sm text-gray-900 group-hover:text-primary-700">{r.title}</h4>
                                                <p className="text-xs font-bold text-gray-400 mt-0.5">{format(new Date(r.date), 'EEEE, MMMM d, yyyy')}</p>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500" />
                                        </button>
                                    ))}
                                    {globalSearchResults.length === 0 && (
                                        <div className="text-center py-16 opacity-30"><History size={40} className="mx-auto mb-3" /><p className="font-black uppercase tracking-widest text-sm">No History Found</p></div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── COPY WEEK MODAL ───────────────────────────────────────── */}
            <AnimatePresence>
                {isCopyModalOpen && (
                    <CopyWeekModal
                        fromDates={prevWeekDays.map(d => format(d, 'yyyy-MM-dd'))}
                        toDates={weekDays.map(d => format(d, 'yyyy-MM-dd'))}
                        plannedMeals={plannedMeals}
                        onConfirm={handleCopyWeek}
                        onClose={() => setIsCopyModalOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Stats Modal */}
            <PlannerStatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
        </div>
    );
}
