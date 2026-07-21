import { useShoppingCart, getWeekId } from '@/contexts/ShoppingCartContext';
import { ShoppingCart as CartIcon, Trash2, Check, DollarSign, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Printer, Share2, Receipt, PieChart, Plus, Edit3, Package, Pencil } from 'lucide-react';
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
import { toTitleCase } from '@/utils/stringUtils';
import { getAisleForIngredient } from '@/utils/aisles';

// ── Store brand colours ──────────────────────────────────────────────────────
const STORE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; shadow: string }> = {
    'Walmart':      { bg: 'from-blue-500 to-blue-600',    text: 'text-blue-600',   border: 'border-blue-100',   icon: '🛒', shadow: 'shadow-blue-100' },
    'Costco':       { bg: 'from-red-500 to-red-600',      text: 'text-red-600',    border: 'border-red-100',    icon: '🏪', shadow: 'shadow-red-100' },
    "Trader Joe's": { bg: 'from-red-400 to-rose-500',     text: 'text-rose-600',   border: 'border-rose-100',   icon: '🌺', shadow: 'shadow-rose-100' },
    'Whole Foods':  { bg: 'from-emerald-500 to-green-600',text: 'text-emerald-600',border: 'border-emerald-100',icon: '🌿', shadow: 'shadow-emerald-100' },
    'Safeway':      { bg: 'from-red-500 to-orange-500',   text: 'text-orange-600', border: 'border-orange-100', icon: '🏬', shadow: 'shadow-orange-100' },
    'Amazon':       { bg: 'from-yellow-400 to-amber-500', text: 'text-amber-600',  border: 'border-amber-100',  icon: '📦', shadow: 'shadow-amber-100' },
    'Real Produce': { bg: 'from-green-400 to-teal-500',   text: 'text-teal-600',   border: 'border-teal-100',   icon: '🥦', shadow: 'shadow-teal-100' },
    'Smart&Final':  { bg: 'from-blue-400 to-indigo-500',  text: 'text-indigo-600', border: 'border-indigo-100', icon: '🛍️', shadow: 'shadow-indigo-100' },
    'Unassigned':   { bg: 'from-gray-400 to-slate-500',   text: 'text-slate-600',  border: 'border-slate-100',  icon: '📋', shadow: 'shadow-slate-100' },
};

function getStoreStyle(storeName: string) {
    return STORE_STYLES[storeName] ?? { bg: 'from-violet-400 to-purple-500', text: 'text-violet-600', border: 'border-violet-100', icon: '🏪', shadow: 'shadow-violet-100' };
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ percent, size = 80, stroke = 7 }: { percent: number; size?: number; stroke?: number }) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="white" strokeWidth={stroke}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
        </svg>
    );
}

const COMMON_STORES = ["Unassigned", "Walmart", "Safeway", "Costco", "Real Produce", "Amazon", "Smart&Final", "Trader Joe's", "Whole Foods"];

export default function ShoppingCart() {
    const { cartItems, removeFromCart, toggleChecked, clearCart, updateQuantity, updatePrice, updateNote, addToCart, getAllWeeks, getWeeklyTotal, loading, weeklyBudget, setWeeklyBudget } = useShoppingCart();
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
    const [showQuickAdd, setShowQuickAdd] = useState(false);

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
            if (data) setAllIngredients(data.map(d => d.name));
        };
        fetchIngredients();
    }, []);

    const weeksWithItems = getAllWeeks();
    const currentWeekId = useMemo(() => getWeekId(viewDate), [viewDate]);

    const handleWeekChange = (newDate: Date) => setViewDate(newDate);
    const goToPreviousWeek = () => handleWeekChange(subWeeks(viewDate, 1));
    const goToNextWeek = () => handleWeekChange(addWeeks(viewDate, 1));
    const goToToday = () => handleWeekChange(new Date());

    const handleAddManualItem = () => {
        if (!manualItemName.trim() || !manualItemAmount || !manualItemUnit.trim()) {
            toast.error('Please fill in all fields');
            return;
        }
        addToCart({
            name: toTitleCase(manualItemName.trim()),
            amount: parseFloat(manualItemAmount),
            unit: manualItemUnit.trim(),
            weekId: currentWeekId,
            price: 0,
            storeName: manualStoreName || 'Unassigned'
        });
        setManualItemName('');
        setManualItemAmount('');
        setManualItemUnit('');
        setShowQuickAdd(false);
        toast.success('Item added!');
    };

    const handlePrint = () => window.print();

    const handleShareClick = () => setIsShareModalOpen(true);

    const handleShare = async (storeFilter: string | 'all') => {
        setIsShareModalOpen(false);
        let textCallback = `Shopping List from Niroz's Kitchen:\n\n`;
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

        if (!hasItems) { toast.error("Cart is empty, nothing to share."); return; }
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Shopping List', text: textCallback });
            } else {
                await navigator.clipboard.writeText(textCallback);
                toast.success('Shopping list copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const grandTotal = weeksWithItems.reduce((total: number, weekId: string) => total + getWeeklyTotal(weekId), 0);
    const totalItems = itemsToDisplay.length;
    const checkedItems = itemsToDisplay.filter((i: any) => i.checked).length;
    const uncheckedCount = cartItems.filter((item: any) => !item.checked).length;
    const checkPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
    const currentViewTotal = itemsToDisplay.reduce((t: number, i: any) => t + (i.price || 0), 0);

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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-rose-50">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full border-4 border-primary-100 border-t-primary-500 animate-spin mx-auto mb-5" />
                    <p className="text-gray-500 font-semibold">Loading your cart…</p>
                </div>
            </div>
        );
    }

    if (cartItems.length === 0 && viewMode === 'all') {
        return (
            <div className="max-w-2xl mx-auto px-4 py-24 text-center">
                <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-primary-100 to-rose-100 flex items-center justify-center mx-auto mb-6 rotate-3">
                    <CartIcon className="text-primary-400" size={48} />
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Cart is Empty</h1>
                <p className="text-gray-400 mb-8 font-medium">Plan your week meals first, then add them to cart automatically.</p>
                <div className="flex items-center justify-center gap-4">
                    <Link
                        to="/planner"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-rose-500 text-white px-8 py-3 rounded-2xl font-black hover:shadow-lg hover:shadow-primary-200 transition-all"
                    >
                        <CalendarIcon size={18} />
                        Go to Planner
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 bg-white text-gray-700 px-8 py-3 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                        Browse Recipes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">

            {/* ── HERO COMMAND CENTRE ─────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-[2.5rem] mb-8 mt-6 bg-gradient-to-br from-primary-500 via-rose-500 to-pink-600 shadow-2xl shadow-rose-200/60">
                {/* Decorative blobs */}
                <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none" />

                <div className="relative z-10 px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        {/* Progress ring */}
                        <div className="relative flex-shrink-0">
                            <ProgressRing percent={checkPercent} size={84} stroke={7} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-white font-black text-lg leading-none">{checkPercent}%</span>
                                <span className="text-white/60 text-[9px] font-bold uppercase">done</span>
                            </div>
                        </div>

                        <div>
                            <p className="text-white/70 text-[11px] font-black uppercase tracking-[0.3em] mb-1">Shopping List</p>
                            {currentViewTotal > 0 ? (
                                <div className="flex items-end gap-3">
                                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
                                        ${currentViewTotal.toFixed(2)}
                                    </h1>
                                    <div className="flex items-center gap-1.5 mb-1.5 group cursor-pointer" onClick={() => {
                                        const newBudget = prompt("Set weekly budget:", weeklyBudget.toString());
                                        if (newBudget && !isNaN(parseFloat(newBudget))) {
                                            setWeeklyBudget(parseFloat(newBudget));
                                        }
                                    }}>
                                        <span className="text-white/60 text-sm font-semibold">/ ${weeklyBudget}</span>
                                        <Pencil size={12} className="text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ) : (
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
                                    {uncheckedCount} Items
                                </h1>
                            )}
                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <span className="text-white/80 text-sm font-semibold">{uncheckedCount} to buy</span>
                                <span className="w-1 h-1 rounded-full bg-white/40" />
                                <span className="text-white/80 text-sm font-semibold">{checkedItems} checked off</span>
                                {grandTotal > 0 && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/40" />
                                        <span className="text-white/80 text-sm font-semibold">${grandTotal.toFixed(2)} total</span>
                                    </>
                                )}
                            </div>
                            
                            {/* Budget Progress Bar */}
                            {currentViewTotal > 0 && (
                                <div className="mt-4 max-w-sm">
                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full ${
                                                currentViewTotal > weeklyBudget ? 'bg-red-500' :
                                                currentViewTotal > weeklyBudget * 0.8 ? 'bg-amber-400' : 'bg-white'
                                            }`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min((currentViewTotal / weeklyBudget) * 100, 100)}%` }}
                                            transition={{ duration: 0.8, ease: 'easeOut' }}
                                        />
                                    </div>
                                    <p className={`text-[10px] font-black uppercase mt-1.5 ${
                                        currentViewTotal > weeklyBudget ? 'text-red-300' : 'text-white/60'
                                    }`}>
                                        {currentViewTotal > weeklyBudget ? 'Over Budget' : `${((currentViewTotal / weeklyBudget) * 100).toFixed(0)}% of budget used`}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setIsLogReceiptOpen(true)}
                            className="flex items-center gap-2 bg-white text-rose-600 px-5 py-2.5 rounded-2xl font-black text-sm hover:bg-rose-50 transition-all shadow-lg shadow-black/10"
                        >
                            <Receipt size={16} />
                            Log Receipt
                        </button>
                        <button
                            onClick={() => setIsStatsOpen(true)}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm"
                        >
                            <PieChart size={16} />
                            <span className="hidden sm:inline">Stats</span>
                        </button>
                        <button
                            onClick={handleShareClick}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm print:hidden"
                        >
                            <Share2 size={16} />
                            <span className="hidden sm:inline">Share</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm print:hidden"
                        >
                            <Printer size={16} />
                        </button>
                        <button
                            onClick={clearCart}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white/70 border border-white/20 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all backdrop-blur-sm print:hidden"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CONTROLS ROW ────────────────────────────────────────── */}
            <div className="mb-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* View mode segmented control */}
                    <div className="relative flex bg-white rounded-2xl p-1 border border-gray-100 shadow-sm gap-1">
                        {(['week', 'month', 'all'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`relative px-5 py-2 rounded-xl font-bold text-sm transition-all z-10 ${viewMode === mode
                                    ? 'bg-gradient-to-r from-primary-500 to-rose-500 text-white shadow-md shadow-primary-200'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                {mode === 'week' ? '📅 Week' : mode === 'month' ? '📆 Month' : '🗓️ All'}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => setIsReceiptsModalOpen(true)}
                            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-50 border border-gray-200 transition-all shadow-sm text-sm print:hidden"
                        >
                            <Receipt size={15} />
                            Receipts
                        </button>

                        {/* Store filter pills */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Store:</span>
                            <select
                                value={globalStoreFilter}
                                onChange={e => setGlobalStoreFilter(e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-0 focus:border-primary-400 shadow-sm"
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

                        {/* Quick Add FAB */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowQuickAdd(v => !v)}
                            className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-rose-500 text-white px-5 py-2 rounded-xl font-black text-sm shadow-lg shadow-primary-200 hover:shadow-xl transition-all"
                        >
                            <Plus size={16} strokeWidth={3} />
                            Add Item
                        </motion.button>
                    </div>
                </div>

                {/* Quick add inline panel */}
                <AnimatePresence>
                    {showQuickAdd && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-gradient-to-br from-primary-50 to-rose-50 rounded-2xl p-5 border border-primary-100">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary-600 mb-4">Quick Add Item</p>
                                <datalist id="cart-item-names">
                                    {Array.from(new Set([...cartItems.map(item => item.name), ...allIngredients])).map(name => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                                <datalist id="unit-suggestions">
                                    {['unit', 'lbs', 'oz', 'gal', 'pcs', 'pk', 'box', 'bag', 'kg', 'g', 'bunch'].map(u => <option key={u} value={u} />)}
                                </datalist>
                                <datalist id="cart-store-names">
                                    {COMMON_STORES.map(store => <option key={store} value={store} />)}
                                </datalist>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    <input
                                        type="text"
                                        list="cart-item-names"
                                        placeholder="Item name"
                                        value={manualItemName}
                                        onChange={e => setManualItemName(e.target.value)}
                                        className="col-span-2 sm:col-span-2 px-4 py-2.5 rounded-xl border border-white bg-white focus:border-primary-400 focus:ring-0 font-medium text-sm shadow-sm"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={manualItemAmount}
                                        onChange={e => setManualItemAmount(e.target.value)}
                                        className="px-3 py-2.5 rounded-xl border border-white bg-white focus:border-primary-400 focus:ring-0 font-bold text-sm text-center shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        list="unit-suggestions"
                                        placeholder="Unit"
                                        value={manualItemUnit}
                                        onChange={e => setManualItemUnit(e.target.value)}
                                        className="px-3 py-2.5 rounded-xl border border-white bg-white focus:border-primary-400 focus:ring-0 font-bold text-sm text-center shadow-sm"
                                    />
                                    <input
                                        type="text"
                                        list="cart-store-names"
                                        placeholder="Store"
                                        value={manualStoreName}
                                        onChange={e => setManualStoreName(e.target.value)}
                                        className="px-3 py-2.5 rounded-xl border border-white bg-white focus:border-primary-400 focus:ring-0 font-bold text-sm shadow-sm"
                                    />
                                </div>
                                <div className="flex gap-3 mt-3">
                                    <button
                                        onClick={handleAddManualItem}
                                        className="flex items-center gap-2 bg-gradient-to-r from-primary-500 to-rose-500 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all"
                                    >
                                        <Plus size={16} strokeWidth={3} />
                                        Add to Cart
                                    </button>
                                    <button
                                        onClick={() => setShowQuickAdd(false)}
                                        className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-white/60 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Week navigation */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 gap-4">
                    <button
                        onClick={goToPreviousWeek}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-semibold text-sm w-full sm:w-auto justify-center"
                    >
                        <ChevronLeft size={18} />
                        Previous
                    </button>

                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={16} className="text-primary-500" />
                            <select
                                value={getYear(viewDate)}
                                onChange={e => handleWeekChange(setYear(viewDate, parseInt(e.target.value)))}
                                className="bg-transparent font-black text-gray-900 border-none focus:ring-0 cursor-pointer text-base hover:text-primary-600 transition-colors"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <span className="text-gray-300">/</span>
                            <select
                                value={getISOWeek(viewDate)}
                                onChange={e => handleWeekChange(setISOWeek(viewDate, parseInt(e.target.value)))}
                                className="bg-transparent font-black text-gray-900 border-none focus:ring-0 cursor-pointer text-base hover:text-primary-600 transition-colors"
                            >
                                {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                                    <option key={w} value={w}>Week {w}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400">
                                {format(currentWeekStart, 'MMM d')} – {format(weekEndDate, 'MMM d, yyyy')}
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
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-semibold text-sm w-full sm:w-auto justify-center"
                    >
                        Next
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* ── CART CONTENT ─────────────────────────────────────────── */}
            <div className="space-y-10">
                <AnimatePresence mode="popLayout">
                    {(() => {
                        if (itemsToDisplay.length === 0) {
                            return (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100"
                                >
                                    <div className="w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 rotate-3 shadow-inner">
                                        <CartIcon className="text-gray-300" size={40} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-2">Nothing here!</h3>
                                    <p className="text-gray-400 font-medium mb-6">No items for this {viewMode}.</p>
                                    <Link to="/planner" className="inline-flex items-center gap-2 text-primary-600 font-black text-sm hover:underline">
                                        <CalendarIcon size={16} />
                                        Plan your week → auto-fill cart
                                    </Link>
                                </motion.div>
                            );
                        }

                        const filteredItems = itemsToDisplay.filter((item: any) => {
                            if (globalStoreFilter === 'all') return true;
                            return (item.storeName || 'Unassigned') === globalStoreFilter;
                        });

                        const grouped = filteredItems.reduce((acc: any, item: any) => {
                            const store = item.storeName || 'Unassigned';
                            if (!acc[store]) acc[store] = [];
                            acc[store].push(item);
                            return acc;
                        }, {});

                        return (
                            <motion.div
                                key="items"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start"
                            >
                                {Object.entries(grouped).map(([storeName, storeItems]: [string, any]) => {
                                    const style = getStoreStyle(storeName);
                                    const storeChecked = storeItems.filter((i: any) => i.checked).length;
                                    const storeTotal = storeItems.length;
                                    const storePercent = storeTotal > 0 ? Math.round((storeChecked / storeTotal) * 100) : 0;
                                    const storeCost = storeItems.reduce((t: number, i: any) => t + (i.price || 0), 0);

                                    return (
                                        <motion.div
                                            key={storeName}
                                            layout
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`bg-white rounded-[2rem] overflow-hidden shadow-lg ${style.shadow} border ${style.border}`}
                                        >
                                            {/* Store header */}
                                            <div className={`bg-gradient-to-r ${style.bg} px-5 py-4`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">{style.icon}</span>
                                                        <div>
                                                            <h3 className="text-white font-black text-base leading-none">{storeName}</h3>
                                                            <p className="text-white/70 text-xs font-semibold mt-0.5">
                                                                {storeChecked}/{storeTotal} done
                                                                {storeCost > 0 && ` · $${storeCost.toFixed(2)}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-white/80 text-sm font-black">{storePercent}%</span>
                                                    </div>
                                                </div>

                                                {/* Store progress bar */}
                                                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-white rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${storePercent}%` }}
                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Items grouped by Aisle */}
                                            <div className="divide-y divide-gray-50 pb-2">
                                                {Object.entries(
                                                    storeItems.reduce((aisles: Record<string, any[]>, item: any) => {
                                                        const aisle = getAisleForIngredient(item.name);
                                                        if (!aisles[aisle]) aisles[aisle] = [];
                                                        aisles[aisle].push(item);
                                                        return aisles;
                                                    }, {})
                                                ).sort(([a], [b]) => a === 'Other 🛒' ? 1 : b === 'Other 🛒' ? -1 : a.localeCompare(b))
                                                .map(([aisleName, aisleItems]: [string, any]) => (
                                                    <div key={aisleName} className="pt-2">
                                                        <div className="px-4 py-1.5 bg-gray-50/50">
                                                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                                                {aisleName}
                                                            </p>
                                                        </div>
                                                        {aisleItems.map((item: any) => (
                                                            <motion.div
                                                                key={item.id}
                                                                layout
                                                                className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/70 transition-colors ${item.checked ? 'opacity-45' : ''}`}
                                                            >
                                                                {/* Checkbox */}
                                                                <motion.button
                                                                    whileTap={{ scale: 0.85 }}
                                                                    onClick={() => toggleChecked(item.id)}
                                                                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                        item.checked
                                                                            ? `bg-gradient-to-br ${style.bg} border-transparent shadow-md`
                                                                            : 'border-gray-200 hover:border-current bg-white'
                                                                    } ${style.text}`}
                                                                >
                                                                    {item.checked && <Check size={13} className="text-white" strokeWidth={4} />}
                                                                </motion.button>

                                                                {/* Item info */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className={`font-semibold text-sm leading-snug ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                                            {item.name}
                                                                        </p>
                                                                        {/* Amount pill */}
                                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.text} bg-current/5 flex-shrink-0`}>
                                                                            {item.amount} {item.unit}
                                                                        </span>
                                                                        {item.purchaseUrl && (
                                                                            <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-600 transition-colors" title="Buy online">
                                                                                <Package size={13} />
                                                                            </a>
                                                                        )}
                                                                        {item.checked && item.purchasedAt && (
                                                                            <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">
                                                                                ✓ {format(new Date(item.purchasedAt), 'h:mm a')}
                                                                            </span>
                                                                        )}
                                                                        {(viewMode === 'month' || viewMode === 'all') && (
                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${style.text} bg-current/5`}>
                                                                                Wk {item.weekId?.split('-')[1]}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Recipe tags */}
                                                                    {item.recipeNames.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                                            {item.recipeNames.map((name: string, idx: number) => (
                                                                                <span key={idx} className="text-[8px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-lg font-black uppercase tracking-tighter border border-gray-100">
                                                                                    {name}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="mt-1 inline-block text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-400 rounded-lg font-black uppercase tracking-tighter border border-blue-100">
                                                                            Manual
                                                                        </span>
                                                                    )}
                                                                    {/* Note */}
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Add note…"
                                                                        value={item.note || ''}
                                                                        onChange={e => updateNote(item.id, e.target.value)}
                                                                        className="mt-1.5 w-full px-0 py-0.5 text-[11px] bg-transparent border-b border-transparent hover:border-gray-100 focus:border-primary-200 focus:bg-transparent rounded-none transition-all text-gray-400 italic focus:outline-none"
                                                                    />
                                                                </div>

                                                                {/* Controls */}
                                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                    {/* Quantity */}
                                                                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            value={item.amount}
                                                                            onChange={e => updateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                                            className="w-10 text-xs font-black text-gray-900 bg-transparent border-none focus:ring-0 text-center"
                                                                        />
                                                                        <span className="text-[9px] font-black uppercase text-gray-400 border-l border-gray-200 pl-1.5 ml-0.5">{item.unit}</span>
                                                                    </div>
                                                                    {/* Price */}
                                                                    <div className="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 relative">
                                                                        <DollarSign size={11} className="text-gray-400 ml-1" strokeWidth={3} />
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.01"
                                                                            placeholder="0.00"
                                                                            value={item.price || ''}
                                                                            onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                                                            className="w-14 text-xs font-black text-gray-900 bg-transparent border-none focus:ring-0 pr-1"
                                                                        />
                                                                    </div>
                                                                    {/* Edit + Delete (visible on hover) */}
                                                                    <button
                                                                        onClick={() => setItemToEdit(item)}
                                                                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => removeFromCart(item.id)}
                                                                        className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-gray-300 opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>

            {/* ── MODALS ──────────────────────────────────────────────── */}
            <CartStatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
            <LogReceiptModal isOpen={isLogReceiptOpen} onClose={() => setIsLogReceiptOpen(false)} />
            <ReceiptsModal isOpen={isReceiptsModalOpen} onClose={() => setIsReceiptsModalOpen(false)} />
            <ShareStoreModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                availableStores={Object.keys(
                    itemsToDisplay.reduce((acc: any, item: any) => {
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
