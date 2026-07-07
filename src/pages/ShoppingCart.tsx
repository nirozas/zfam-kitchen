import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { ShoppingCart as CartIcon, Trash2, X, Check, DollarSign, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer, Share2, Receipt, PieChart, Plus, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { addWeeks, subWeeks, startOfWeek, format, getYear, getISOWeek, setISOWeek, setYear, addDays, isSameMonth } from 'date-fns';
import toast from 'react-hot-toast';
import { CartStatsModal } from '@/components/CartStatsModal';
import { LogReceiptModal } from '@/components/LogReceiptModal';
import { EditItemModal } from '@/components/EditItemModal';
import { ReceiptsModal } from '@/components/ReceiptsModal';
import { ShareStoreModal } from '@/components/ShareStoreModal';
import { supabase } from '@/lib/supabase';
import { CartItem } from '@/contexts/ShoppingCartContext';


export default function ShoppingCart() {
    const { cartItems, removeFromCart, toggleChecked, clearCart, clearWeek, updateQuantity, updatePrice, updateNote, addToCart, getAllWeeks, getWeeklyTotal, loading } = useShoppingCart();
    const [viewDate, setViewDate] = useState(new Date());
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemAmount, setManualItemAmount] = useState('');
    const [manualItemUnit, setManualItemUnit] = useState('');
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isLogReceiptOpen, setIsLogReceiptOpen] = useState(false);
    const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [allIngredients, setAllIngredients] = useState<string[]>([]);
    const [manualStoreName, setManualStoreName] = useState('');
    const [viewMode, setViewMode] = useState<'week' | 'month' | 'all'>('week');
    const [globalStoreFilter, setGlobalStoreFilter] = useState<string>('all');
    const [itemToEdit, setItemToEdit] = useState<CartItem | null>(null);

    const COMMON_STORES = [
        "Unassigned",
        "Walmart",
        "Safeway",
        "Costco",
        "Real Produce",
        "Amazon",
        "Smart&Final",
        "Trader Joe's",
        "Whole Foods"
    ];

    const getDateFromWeekId = (weekId: string) => {
        if (!weekId || !weekId.includes('-')) return new Date();
        const [year, week] = weekId.split('-');
        const d = setYear(new Date(), parseInt(year));
        return setISOWeek(d, parseInt(week));
    };

    const itemsToDisplay = useMemo(() => {
        return cartItems.filter((item: any) => {
            if (viewMode === 'all') return true;
            if (viewMode === 'week') return item.weekId === getWeekId(viewDate);
            if (viewMode === 'month') {
                const itemDate = getDateFromWeekId(item.weekId);
                return isSameMonth(itemDate, viewDate);
            }
            return true;
        });
    }, [cartItems, viewMode, viewDate]);

    useEffect(() => {
        const fetchIngredients = async () => {
            const { data } = await supabase.from('ingredients').select('name');
            if (data) {
                setAllIngredients(data.map(d => d.name));
            }
        };
        fetchIngredients();
    }, []);

    const weeksWithItems = getAllWeeks();

    const currentWeekId = useMemo(() => getWeekId(viewDate), [viewDate]);

    // Update selected week when view date changes
    const handleWeekChange = (newDate: Date) => {
        setViewDate(newDate);
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
            price: 0,
            storeName: manualStoreName
        });

        // Reset form
        setManualItemName('');
        setManualItemAmount('');
        setManualItemUnit('');
    };

    const handlePrint = () => {
        window.print();
    };

    const handleShareClick = () => {
        setIsShareModalOpen(true);
    };

    const handleShare = async (storeFilter: string | 'all') => {
        setIsShareModalOpen(false);
        // Generate text list
        let textCallback = `Shopping List from Niroz's Kitchen:\n\n`;

        // Filter items based on current view
        const visibleWeeks = viewMode === 'all'
            ? [...new Set([...weeksWithItems, currentWeekId])].sort().reverse()
            : viewMode === 'month' 
            ? [...new Set(cartItems.filter((i: any) => isSameMonth(getDateFromWeekId(i.weekId), viewDate)).map((i: any) => i.weekId))]
            : [currentWeekId];

        let hasItems = false;

        visibleWeeks.forEach(weekId => {
            const items = cartItems.filter((item: any) => item.weekId === weekId);
            if (items.length > 0) {
                hasItems = true;
                textCallback += `Week ${weekId}:\n`;
                
                // Group by store
                const groupedItems = items.reduce((acc: any, item: any) => {
                    const store = item.storeName || 'Unassigned';
                    if (!acc[store]) acc[store] = [];
                    acc[store].push(item);
                    return acc;
                }, {});

                const storesToShare = storeFilter === 'all' 
                    ? Object.entries(groupedItems) 
                    : Object.entries(groupedItems).filter(([store]) => store === storeFilter);

                storesToShare.forEach(([store, storeItems]: [string, any]) => {
                    textCallback += `\n[${store}]\n`;
                    storeItems.forEach((item: any) => {
                        textCallback += `- [${item.checked ? 'x' : ' '}] ${item.name} (${item.amount} ${item.unit})\n`;
                    });
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

    if (cartItems.length === 0 && viewMode === 'all') {
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
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Shopping List</h1>
                        <p className="text-gray-500 mt-1 font-medium">
                            {uncheckedCount} {uncheckedCount === 1 ? 'item' : 'items'} to buy
                        </p>
                    </div>
                    
                    {/* Quick Add Form */}
                    <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl px-4 py-3 border-2 border-dashed border-primary-200 flex-shrink-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-primary-700 mr-2">Quick Add</span>
                            <datalist id="cart-item-names">
                                {Array.from(new Set([...cartItems.map(item => item.name), ...allIngredients])).map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                            <input
                                type="text"
                                list="cart-item-names"
                                placeholder="What do you need?"
                                value={manualItemName}
                                onChange={(e) => setManualItemName(e.target.value)}
                                className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-primary-100 focus:border-primary-400 focus:ring-0 font-medium text-sm bg-white"
                            />
                            <input
                                type="number"
                                placeholder="Q"
                                value={manualItemAmount}
                                onChange={(e) => setManualItemAmount(e.target.value)}
                                className="w-14 px-2 py-1.5 rounded-lg border border-primary-100 focus:border-primary-400 focus:ring-0 font-bold text-xs text-center"
                            />
                            <input
                                type="text"
                                placeholder="Unit"
                                value={manualItemUnit}
                                onChange={(e) => setManualItemUnit(e.target.value)}
                                className="w-14 px-2 py-1.5 rounded-lg border border-primary-100 focus:border-primary-400 focus:ring-0 font-bold text-xs text-center"
                            />
                            <datalist id="cart-store-names">
                                {COMMON_STORES.map(store => (
                                    <option key={store} value={store} />
                                ))}
                            </datalist>
                            <input
                                type="text"
                                list="cart-store-names"
                                placeholder="Store (optional)"
                                value={manualStoreName}
                                onChange={(e) => setManualStoreName(e.target.value)}
                                className="px-3 py-1.5 min-w-[100px] rounded-lg border border-primary-100 focus:border-primary-400 focus:ring-0 font-bold text-xs bg-white text-gray-700"
                            />
                            <button
                                onClick={handleAddManualItem}
                                className="px-3 py-1.5 flex items-center gap-1 bg-primary-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-primary-700 transition-colors whitespace-nowrap"
                            >
                                <Plus size={14} strokeWidth={3} />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 xl:mt-2">
                    {grandTotal > 0 && (
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Amount</p>
                            <p className="text-2xl font-black text-primary-600 leading-none">${grandTotal.toFixed(2)}</p>
                        </div>
                    )}
                    <button
                        onClick={() => setIsStatsOpen(true)}
                        className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 border border-gray-200 transition-all shadow-sm flex-shrink-0 text-sm print:hidden"
                    >
                        <PieChart size={16} />
                        Stats
                    </button>
                    <button
                        onClick={handleShareClick}
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

            {/* Calendar Navigation Header & Store Filters */}
            <div className="mb-8 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setViewMode('all')}
                            className={`px-5 py-2 rounded-xl font-bold transition-all text-sm ${viewMode === 'all'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100 shadow-sm'
                                }`}
                        >
                            Full History
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-5 py-2 rounded-xl font-bold transition-all text-sm ${viewMode === 'month'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100 shadow-sm'
                                }`}
                        >
                            Monthly View
                        </button>
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-5 py-2 rounded-xl font-bold transition-all text-sm ${viewMode === 'week'
                                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100 shadow-sm'
                                }`}
                        >
                            Focus Week
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsLogReceiptOpen(true)}
                            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 flex-shrink-0 text-sm print:hidden"
                        >
                            <Receipt size={16} />
                            Log Receipt
                        </button>
                        <button
                            onClick={() => setIsReceiptsModalOpen(true)}
                            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 border border-gray-200 transition-all shadow-sm flex-shrink-0 text-sm print:hidden"
                        >
                            <Receipt size={16} />
                            See Receipts
                        </button>
                        <div className="w-px h-8 bg-gray-200 mx-2 hidden sm:block"></div>
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Store:</span>
                        <select
                            value={globalStoreFilter}
                            onChange={(e) => setGlobalStoreFilter(e.target.value)}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-0 focus:border-primary-400 cursor-pointer shadow-sm min-w-[150px]"
                        >
                            <option value="all">All Stores</option>
                            {Object.keys(
                                cartItems.reduce((acc: any, item: any) => {
                                    acc[item.storeName || 'Unassigned'] = true;
                                    return acc;
                                }, {})
                            ).sort().map(store => (
                                <option key={store} value={store}>{store}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-100 gap-4">
                    <button
                        onClick={goToPreviousWeek}
                        className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full sm:w-auto justify-center"
                    >
                        <ChevronLeft size={20} />
                        <span className="font-medium">Previous</span>
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
                        <span className="font-medium">Next</span>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                <AnimatePresence mode="popLayout">
                    {(() => {
                        const currentTotal = itemsToDisplay.reduce((total: number, item: any) => total + (item.price || 0), 0);
                        
                        if (itemsToDisplay.length === 0) {
                            return (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-sm"
                                >
                                    <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 transform rotate-3">
                                        <CartIcon className="text-gray-300" size={36} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Nothing here!</h3>
                                    <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">Ready to fill your kitchen? Add some items to get started!</p>
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-6 pt-4 first:pt-0"
                            >
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-primary-500 mb-1 leading-none">
                                            {viewMode === 'all' ? 'All Time' : viewMode === 'month' ? format(viewDate, 'MMMM yyyy') : `Week ${getWeekId(viewDate)}`}
                                        </span>
                                        <h2 className="text-2xl font-black text-gray-900 leading-none">Shopping List</h2>
                                    </div>
                                    {currentTotal > 0 && (
                                        <div className="px-4 py-2 bg-primary-50 rounded-xl border border-primary-100">
                                            <span className="text-[10px] font-black uppercase tracking-tighter text-primary-600 block leading-none mb-1">Estimated</span>
                                            <div className="flex items-center gap-1 text-primary-900">
                                                <DollarSign size={16} strokeWidth={3} />
                                                <span className="text-lg font-black leading-none">{currentTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                                    {Object.entries(
                                        itemsToDisplay
                                            .filter((item: any) => {
                                                if (globalStoreFilter === 'all') return true;
                                                return (item.storeName || 'Unassigned') === globalStoreFilter;
                                            })
                                            .reduce((acc: any, item: any) => {
                                                const store = item.storeName || 'Unassigned';
                                                if (!acc[store]) acc[store] = [];
                                                acc[store].push(item);
                                                return acc;
                                            }, {})
                                    ).map(([storeName, storeItems]: [string, any]) => (
                                        <div key={storeName} className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden divide-y divide-gray-50">
                                            <div className="bg-gray-50 px-4 py-2 font-bold text-sm text-gray-700 flex items-center justify-between">
                                                <span>{storeName}</span>
                                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full shadow-sm">{storeItems.length} items</span>
                                            </div>
                                            {storeItems.map((item: any) => (
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
                                                <div className="flex items-center gap-2">
                                                    <p className={`text-sm md:text-base font-medium leading-relaxed ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                        {item.name}
                                                    </p>
                                                    {(viewMode === 'month' || viewMode === 'all') && (
                                                        <span className="text-[10px] text-primary-600 font-medium bg-primary-50 px-1.5 py-0.5 rounded ml-2">
                                                            Week {item.weekId}
                                                        </span>
                                                    )}
                                                    {item.purchaseUrl && (
                                                        <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 transition-colors" title="Buy this ingredient">
                                                            <CartIcon size={14} />
                                                        </a>
                                                    )}
                                                    {item.checked && item.purchasedAt && (
                                                        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded ml-2">
                                                            Bought at {format(new Date(item.purchasedAt), 'h:mm a')}
                                                        </span>
                                                    )}
                                                </div>
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
                                                    onClick={() => setItemToEdit(item)}
                                                    className="p-1.5 md:p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 opacity-0 group-hover:opacity-100"
                                                    title="Edit Item"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="p-1.5 md:p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors text-gray-400 opacity-0 group-hover:opacity-100"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            </motion.div>
                                        ))}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
            {/* Modals */}
            <CartStatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
            <LogReceiptModal isOpen={isLogReceiptOpen} onClose={() => setIsLogReceiptOpen(false)} />
            <ReceiptsModal isOpen={isReceiptsModalOpen} onClose={() => setIsReceiptsModalOpen(false)} />
            <ShareStoreModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                availableStores={Object.keys(
                    itemsToDisplay
                        .reduce((acc: any, item: any) => {
                            acc[item.storeName || 'Unassigned'] = true;
                            return acc;
                        }, {})
                )}
                onShare={handleShare}
            />
            <EditItemModal
                isOpen={itemToEdit !== null}
                onClose={() => setItemToEdit(null)}
                item={itemToEdit}
            />
        </div>
    );
}
