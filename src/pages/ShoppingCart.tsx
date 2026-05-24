import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { ShoppingCart as CartIcon, Trash2, X, Check, DollarSign, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { addWeeks, subWeeks, startOfWeek, format, getYear, getISOWeek, setISOWeek, setYear, addDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function ShoppingCart() {
    const { cartItems, removeFromCart, toggleChecked, clearCart, clearWeek, updateQuantity, updatePrice, updateNote, addToCart, getAllWeeks, getWeeklyTotal, loading } = useShoppingCart();
    const [selectedWeek, setSelectedWeek] = useState<string | 'all'>(getWeekId(new Date()));
    const [viewDate, setViewDate] = useState(new Date());
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemAmount, setManualItemAmount] = useState('');
    const [manualItemUnit, setManualItemUnit] = useState('');

    const weeksWithItems = getAllWeeks();

    const currentWeekId = useMemo(() => getWeekId(viewDate), [viewDate]);

    // Update selected week when view date changes, unless 'all' is selected
    const handleWeekChange = (newDate: Date) => {
        setViewDate(newDate);
        if (selectedWeek !== 'all') {
            setSelectedWeek(getWeekId(newDate));
        }
    };

    const goToPreviousWeek = () => handleWeekChange(subWeeks(viewDate, 1));
    const goToNextWeek = () => handleWeekChange(addWeeks(viewDate, 1));
    const goToToday = () => handleWeekChange(new Date());

    const handleAddManualItem = () => {
        if (!manualItemName.trim() || !manualItemAmount || !manualItemUnit.trim()) {
            toast.error('Please fill in all fields');
            return;
        }

        addToCart({
            name: manualItemName.trim(),
            amount: parseFloat(manualItemAmount),
            unit: manualItemUnit.trim(),
            weekId: currentWeekId,
            price: 0
        });

        // Reset form
        setManualItemName('');
        setManualItemAmount('');
        setManualItemUnit('');
    };

    const handlePrint = () => {
        window.print();
    };

    const handleShare = async () => {
        // Generate text list
        let textCallback = `Shopping List from Niroz's Kitchen:\n\n`;

        // Filter items based on current view
        const visibleWeeks = selectedWeek === 'all'
            ? [...new Set([...weeksWithItems, currentWeekId])].sort().reverse()
            : [selectedWeek];

        let hasItems = false;

        visibleWeeks.forEach(weekId => {
            const items = cartItems.filter((item: any) => item.weekId === weekId);
            if (items.length > 0) {
                hasItems = true;
                textCallback += `Week ${weekId}:\n`;
                items.forEach((item: any) => {
                    textCallback += `- [${item.checked ? 'x' : ' '}] ${item.name} (${item.amount} ${item.unit})\n`;
                });
                textCallback += '\n';
            }
        });

        if (!hasItems) {
            toast.error("Cart is empty, nothing to share.");
            return;
        }

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Shopping List',
                    text: textCallback,
                });
            } else {
                await navigator.clipboard.writeText(textCallback);
                toast.success('Shopping list copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const grandTotal = weeksWithItems.reduce((total: number, weekId: string) => total + getWeeklyTotal(weekId), 0);
    const uncheckedCount = cartItems.filter((item: any) => !item.checked).length;

    // Generate year range for selector (from oldest item to next year)
    const years = useMemo(() => {
        const itemYears = weeksWithItems.map(w => parseInt(w.split('-')[0]));
        const minYear = Math.min(getYear(new Date()), ...itemYears);
        const maxYear = getYear(new Date()) + 1;
        const yearsArr = [];
        for (let y = maxYear; y >= minYear; y--) yearsArr.push(y);
        return yearsArr;
    }, [weeksWithItems]);

    const currentWeekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
    const weekEndDate = addDays(currentWeekStart, 6);
    const isCurrentWeek = getWeekId(new Date()) === currentWeekId;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your cart...</p>
                </div>
            </div>
        );
    }

    if (cartItems.length === 0 && selectedWeek === 'all') {
        return (
            <div className="max-w-6xl mx-auto px-4 py-16 text-center">
                <CartIcon className="w-24 h-24 mx-auto text-gray-300 mb-4" />
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Shopping Cart is Empty</h1>
                <p className="text-gray-500 mb-8">Add ingredients from your favorite recipes to get started!</p>
                <Link
                    to="/"
                    className="inline-block bg-primary-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-primary-700 transition-colors"
                >
                    Browse Recipes
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Shopping List</h1>
                    <p className="text-gray-500 mt-1 font-medium">
                        {uncheckedCount} {uncheckedCount === 1 ? 'item' : 'items'} to buy
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    {grandTotal > 0 && (
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Amount</p>
                            <p className="text-2xl font-black text-primary-600 leading-none">${grandTotal.toFixed(2)}</p>
                        </div>
                    )}
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-xl transition-all font-bold border border-transparent hover:border-primary-100 print:hidden text-sm"
                    >
                        <Share2 size={16} />
                        Share List
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-xl transition-all font-semibold border border-transparent hover:border-gray-200 print:hidden"
                    >
                        <Printer size={18} />
                        Print
                    </button>
                    <button
                        onClick={clearCart}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold border border-transparent hover:border-red-100 print:hidden text-sm"
                    >
                        <Trash2 size={16} />
                        Clear All
                    </button>
                </div>
            </div>

            {/* Calendar Navigation Header - Redesigned to match Planner */}
            <div className="mb-8 space-y-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedWeek('all')}
                        className={`px-5 py-2 rounded-xl font-bold transition-all text-sm ${selectedWeek === 'all'
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100 shadow-sm'
                            }`}
                    >
                        Full History
                    </button>
                    {selectedWeek === 'all' && (
                        <button
                            onClick={() => setSelectedWeek(currentWeekId)}
                            className="px-5 py-2 rounded-xl font-bold transition-all bg-white text-gray-400 hover:text-primary-600 border border-gray-100 shadow-sm text-sm"
                        >
                            Focus Week
                        </button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100 gap-4">
                    <button
                        onClick={goToPreviousWeek}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full sm:w-auto justify-center"
                    >
                        <ChevronLeft size={20} />
                        <span className="font-medium">Previous Week</span>
                    </button>

                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-3">
                            <CalendarIcon size={20} className="text-primary-600" />
                            <div className="flex items-center gap-1">
                                <select
                                    value={getYear(viewDate)}
                                    onChange={(e) => handleWeekChange(setYear(viewDate, parseInt(e.target.value)))}
                                    className="bg-transparent font-bold text-gray-900 border-none focus:ring-0 cursor-pointer p-0 text-lg hover:text-primary-600 transition-colors"
                                >
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <span className="text-gray-300 font-light px-1">/</span>
                                <select
                                    value={getISOWeek(viewDate)}
                                    onChange={(e) => handleWeekChange(setISOWeek(viewDate, parseInt(e.target.value)))}
                                    className="bg-transparent font-bold text-gray-900 border-none focus:ring-0 cursor-pointer p-0 text-lg hover:text-primary-600 transition-colors"
                                >
                                    {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                                        <option key={w} value={w}>Week {w}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-500">
                                {format(currentWeekStart, 'MMM d')} - {format(weekEndDate, 'MMM d, yyyy')}
                            </span>
                            {!isCurrentWeek && (
                                <button
                                    onClick={goToToday}
                                    className="px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter bg-primary-100 text-primary-700 rounded-full hover:bg-primary-200 transition-colors"
                                >
                                    Today
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={goToNextWeek}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full sm:w-auto justify-center"
                    >
                        <span className="font-medium">Next Week</span>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                <AnimatePresence mode="popLayout">
                    {/* Combine navigation week and all historical weeks */}
                    {[...new Set([...weeksWithItems, currentWeekId])].sort().reverse().map((weekId: string) => {
                        const weekTotal = getWeeklyTotal(weekId);
                        const items = cartItems.filter((item: any) => item.weekId === weekId);
                        const isSelected = selectedWeek === 'all' || selectedWeek === weekId;

                        if (!isSelected) return null;

                        // Only show empty state if this specific week is selected
                        if (items.length === 0) {
                            if (selectedWeek === weekId) {
                                return (
                                    <motion.div
                                        key={`empty-${weekId}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-sm"
                                    >
                                        <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                            <CartIcon className="text-gray-300" size={36} />
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-2">Week {weekId} is Empty</h3>
                                        <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">Ready to fill your kitchen? Head back to the planner to add some delicious recipes!</p>
                                        <Link to="/planner" className="inline-flex items-center gap-3 bg-primary-600 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 active:scale-95">
                                            Open Meal Planner
                                            <ChevronRight size={20} />
                                        </Link>
                                    </motion.div>
                                );
                            }
                            return null;
                        }

                        return (
                            <motion.div
                                key={weekId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-6 pt-4 first:pt-0"
                            >
                                {/* Week Header Styled like Planner Day Headers */}
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary-500 mb-1 leading-none">
                                            Shopping List
                                        </span>
                                        <h2 className="text-2xl font-black text-gray-900 leading-none">Week {weekId}</h2>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {weekTotal > 0 && (
                                            <div className="px-4 py-2 bg-primary-50 rounded-xl border border-primary-100">
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-primary-600 block leading-none mb-1">Estimated</span>
                                                <div className="flex items-center gap-1 text-primary-900">
                                                    <DollarSign size={16} strokeWidth={3} />
                                                    <span className="text-lg font-black leading-none">{weekTotal.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => clearWeek(weekId)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Clear Week"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Manual Add Form */}
                                {selectedWeek === weekId && (
                                    <div className="bg-gradient-to-br from-primary-50 to-white rounded-[1.5rem] p-4 border-2 border-dashed border-primary-200 mb-3 md:max-w-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-[10px] font-black uppercase tracking-wider text-primary-700">Quick Add</h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="text"
                                                placeholder="What do you need?"
                                                value={manualItemName}
                                                onChange={(e) => setManualItemName(e.target.value)}
                                                className="flex-1 min-w-[150px] px-4 py-2 rounded-xl border border-primary-100 focus:border-primary-400 focus:ring-0 font-medium text-sm bg-white"
                                            />
                                            <input
                                                type="number"
                                                placeholder="Q"
                                                value={manualItemAmount}
                                                onChange={(e) => setManualItemAmount(e.target.value)}
                                                className="w-16 px-2 py-1.5 rounded-xl border border-primary-100 focus:border-primary-400 focus:ring-0 font-bold text-xs text-center"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Unit"
                                                value={manualItemUnit}
                                                onChange={(e) => setManualItemUnit(e.target.value)}
                                                className="w-16 px-2 py-1.5 rounded-xl border border-primary-100 focus:border-primary-400 focus:ring-0 font-bold text-xs text-center"
                                            />
                                            <button
                                                onClick={handleAddManualItem}
                                                className="px-4 py-1.5 bg-primary-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-primary-700 transition-colors whitespace-nowrap"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden divide-y divide-gray-50">
                                    {items.map((item: any) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            className={`flex items-center gap-3 p-2.5 hover:bg-gray-50/50 transition-colors ${item.checked ? 'opacity-40' : ''
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleChecked(item.id)}
                                                className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.checked
                                                    ? 'bg-primary-500 border-primary-500 shadow-lg shadow-primary-100'
                                                    : 'border-gray-200 hover:border-primary-400 bg-white'
                                                    }`}
                                            >
                                                {item.checked && <Check size={16} className="text-white" strokeWidth={4} />}
                                            </button>

                                            <div className="flex-1 min-w-0 py-1">
                                                <p className={`text-sm md:text-base font-medium leading-relaxed ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                    {item.name}
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    {item.recipeNames.map((name: string, idx: number) => (
                                                        <span key={idx} className="text-[9px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-lg font-black uppercase tracking-tighter border border-gray-100">
                                                            {name}
                                                        </span>
                                                    ))}
                                                    {item.recipeNames.length === 0 && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-lg font-black uppercase tracking-tighter border border-blue-100">
                                                            Manual
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Note Input - Visible on mobile below the name */}
                                                <div className="mt-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Add note..."
                                                        value={item.note || ''}
                                                        onChange={(e) => updateNote(item.id, e.target.value)}
                                                        className="w-full sm:w-64 px-2 py-1 text-[11px] bg-transparent border-b border-transparent hover:border-gray-100 focus:border-primary-200 focus:bg-primary-50/30 rounded transition-all text-gray-500 italic"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center bg-gray-50 rounded-xl p-0.5 border border-gray-100">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.amount}
                                                        onChange={(e) => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                        className="w-12 px-1 py-1 text-xs font-black text-gray-900 bg-transparent border-none focus:ring-0 text-center"
                                                    />
                                                    <span className="text-[9px] font-black uppercase text-gray-400 pr-1.5 border-l border-gray-200 pl-1.5 ml-0.5">{item.unit}</span>
                                                </div>

                                                <div className="flex items-center bg-gray-50 rounded-xl p-0.5 border border-gray-100">
                                                    <div className="pl-1.5 pr-0.5 text-gray-400">
                                                        <DollarSign size={12} strokeWidth={3} />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        value={item.price || ''}
                                                        onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                                        className="w-16 px-1 py-1 text-xs font-black text-gray-900 bg-transparent border-none focus:ring-0"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
