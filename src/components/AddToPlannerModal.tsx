import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '@/lib/types';
import { X, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format, startOfWeek, addDays } from 'date-fns';
import { useMealPlanner } from '@/contexts/MealPlannerContext';
import toast from 'react-hot-toast';

interface AddToPlannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipe: Recipe;
}

export default function AddToPlannerModal({ isOpen, onClose, recipe }: AddToPlannerModalProps) {
    const { addRecipeToDate, plannedMeals } = useMealPlanner();
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const currentWeekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

    if (!isOpen) return null;

    const handleAddToDate = (dateStr: string) => {
        addRecipeToDate(recipe, dateStr);
        
        toast.success(`Added "${recipe.title}" to ${format(new Date(dateStr), 'EEEE')}!`, {
            icon: '🗓️',
            style: {
                borderRadius: '12px',
                background: '#333',
                color: '#fff',
            },
        });
        onClose();
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
                    >
                        <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-primary-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                    <CalendarIcon size={24} />
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight line-clamp-1">Add to Planner</h2>
                                    <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-primary-500 line-clamp-1">{recipe.title}</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[1.5rem] transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-gray-50/50">
                            <div className="flex items-center justify-between mb-6">
                                <button 
                                    onClick={() => setWeekOffset(prev => prev - 1)}
                                    className="px-4 py-2 text-xs sm:text-sm font-bold text-gray-500 hover:bg-white hover:text-primary-600 rounded-xl transition-all border border-transparent hover:border-gray-200 shadow-sm"
                                >
                                    Last Week
                                </button>
                                <span className="font-bold text-gray-700 text-sm sm:text-base">
                                    {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                                </span>
                                <button 
                                    onClick={() => setWeekOffset(prev => prev + 1)}
                                    className="px-4 py-2 text-xs sm:text-sm font-bold text-gray-500 hover:bg-white hover:text-primary-600 rounded-xl transition-all border border-transparent hover:border-gray-200 shadow-sm"
                                >
                                    Next Week
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {weekDays.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const isToday = format(today, 'yyyy-MM-dd') === dateStr;
                                    const meals = plannedMeals[dateStr] || [];
                                    const hasThisRecipe = meals.some(m => m.recipe?.id === recipe.id);

                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => !hasThisRecipe && handleAddToDate(dateStr)}
                                            disabled={hasThisRecipe}
                                            className={`p-4 rounded-2xl flex flex-col gap-2 transition-all border-2 text-left relative overflow-hidden group
                                                ${hasThisRecipe 
                                                    ? 'bg-green-50/50 border-green-200 cursor-not-allowed opacity-70' 
                                                    : 'bg-white border-transparent hover:border-primary-300 hover:shadow-md'
                                                }
                                                ${isToday && !hasThisRecipe ? 'ring-2 ring-primary-500/50' : ''}
                                            `}
                                        >
                                            <div className="flex items-center justify-between z-10">
                                                <div className="flex items-baseline gap-2">
                                                    <span className={`text-lg font-black ${isToday ? 'text-primary-600' : 'text-gray-900'}`}>
                                                        {format(day, 'EEE')}
                                                    </span>
                                                    <span className={`text-sm font-bold ${isToday ? 'text-primary-400' : 'text-gray-400'}`}>
                                                        {format(day, 'd')}
                                                    </span>
                                                </div>
                                                {hasThisRecipe && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-green-600 bg-green-100 px-2 py-1 rounded-lg">
                                                        <CheckCircle2 size={12} strokeWidth={3} /> Added
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex-1 mt-2 z-10 w-full">
                                                {meals.length > 0 ? (
                                                    <div className="flex flex-col gap-1 w-full">
                                                        {meals.map((m, idx) => (
                                                            <div key={idx} className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 w-full">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                                                <span className="line-clamp-1 break-all">{m.title}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs font-medium text-gray-400 italic">Empty</div>
                                                )}
                                            </div>
                                            
                                            {!hasThisRecipe && (
                                                <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors z-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
