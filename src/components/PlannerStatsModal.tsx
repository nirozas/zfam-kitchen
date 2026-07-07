import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PieChart, TrendingUp, Utensils, Store, ShoppingBag } from 'lucide-react';
import { useMealPlanner } from '@/contexts/MealPlannerContext';
import { format } from 'date-fns';

interface PlannerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PlannerStatsModal = ({ isOpen, onClose }: PlannerStatsModalProps) => {
    const { plannedMeals, dailyExpenses } = useMealPlanner();
    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const stats = useMemo(() => {
        let restaurantExpenses = 0;
        let homeExpenses = 0;
        let restaurantCount = 0;
        let homeCookedCount = 0;
        
        let meatCount = 0;
        let chickenCount = 0;
        let fishCount = 0;
        let vegCount = 0;
        
        const categoryCounts: Record<string, number> = {};

        const isIncluded = (dateStr: string) => {
            if (viewMode === 'month') return dateStr.startsWith(format(selectedDate, 'yyyy-MM'));
            return dateStr.startsWith(format(selectedDate, 'yyyy'));
        };

        // Process expenses
        Object.entries(dailyExpenses).forEach(([dateStr, expense]) => {
            if (isIncluded(dateStr)) {
                if (expense.is_restaurant) {
                    restaurantExpenses += Number(expense.expense_amount) || 0;
                    restaurantCount++;
                } else {
                    homeExpenses += Number(expense.expense_amount) || 0;
                }
            }
        });

        // Process meals
        Object.entries(plannedMeals).forEach(([dateStr, meals]) => {
            if (isIncluded(dateStr)) {
                meals.forEach(meal => {
                    homeCookedCount++;
                    if (meal.recipe) {
                        const tagsStr = meal.recipe.tags?.map(t => t.name?.toLowerCase() || '').join(' ') || '';
                        const catStr = meal.recipe.category?.name?.toLowerCase() || '';
                        const ingStr = meal.recipe.ingredients?.map(i => i.ingredient?.name?.toLowerCase() || '').join(' ') || '';
                        
                        const searchable = `${tagsStr} ${catStr} ${ingStr}`;

                        // Protein
                        if (searchable.includes('meat') || searchable.includes('beef') || searchable.includes('lamb')) meatCount++;
                        if (searchable.includes('chicken') || searchable.includes('poultry')) chickenCount++;
                        if (searchable.includes('fish') || searchable.includes('seafood')) fishCount++;
                        if (searchable.includes('vegetarian') || searchable.includes('vegan') || searchable.includes('veg')) vegCount++;

                        // Type dynamically
                        const displayCat = meal.recipe.category?.name || 'Uncategorized';
                        categoryCounts[displayCat] = (categoryCounts[displayCat] || 0) + 1;
                    }
                });
            }
        });

        return {
            restaurantExpenses, homeExpenses, restaurantCount, homeCookedCount,
            meatCount, chickenCount, fishCount, vegCount,
            categoryCounts
        };
    }, [plannedMeals, dailyExpenses, viewMode, selectedDate]);

    const changeDate = (dir: number) => {
        const newDate = new Date(selectedDate);
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + dir);
        else newDate.setFullYear(newDate.getFullYear() + dir);
        setSelectedDate(newDate);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center p-4 sm:p-6 overflow-y-auto"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                <PieChart size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Planner Statistics</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="p-6 bg-white border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setViewMode('year')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'year' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Annual
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                                ←
                            </button>
                            <span className="font-bold text-gray-800 min-w-[120px] text-center">
                                {viewMode === 'month' ? format(selectedDate, 'MMMM yyyy') : format(selectedDate, 'yyyy')}
                            </span>
                            <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
                                →
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto bg-gray-50/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                <Store size={24} className="text-orange-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">${stats.restaurantExpenses.toFixed(2)}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Restaurant Exp.</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                <ShoppingBag size={24} className="text-emerald-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">${stats.homeExpenses.toFixed(2)}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Other Exp.</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                <Utensils size={24} className="text-primary-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">{stats.homeCookedCount}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Planned Meals</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
                                <TrendingUp size={24} className="text-blue-500 mb-2" />
                                <span className="text-2xl font-black text-gray-900">{stats.homeCookedCount + stats.restaurantCount}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Events</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Protein Type</h3>
                                <div className="space-y-3">
                                    <StatBar label="Meat / Beef / Lamb" count={stats.meatCount} total={stats.homeCookedCount} color="bg-red-500" />
                                    <StatBar label="Chicken / Poultry" count={stats.chickenCount} total={stats.homeCookedCount} color="bg-amber-500" />
                                    <StatBar label="Fish / Seafood" count={stats.fishCount} total={stats.homeCookedCount} color="bg-blue-500" />
                                    <StatBar label="Vegetarian / Vegan" count={stats.vegCount} total={stats.homeCookedCount} color="bg-emerald-500" />
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Meal Category</h3>
                                <div className="space-y-3">
                                    {Object.entries(stats.categoryCounts).length === 0 && (
                                        <p className="text-sm text-gray-400 italic">No categories yet.</p>
                                    )}
                                    {Object.entries(stats.categoryCounts)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([cat, count], i) => (
                                            <StatBar 
                                                key={cat} 
                                                label={cat} 
                                                count={count} 
                                                total={stats.homeCookedCount} 
                                                color={['bg-primary-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'][i % 7]} 
                                            />
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const StatBar = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    
    return (
        <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700">{label}</span>
                <span className="text-gray-500">{count} ({percentage}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
};
