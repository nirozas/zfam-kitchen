import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3, TrendingUp, ShoppingBag, Store, PieChart, Receipt } from 'lucide-react';
import { useShoppingCart, ShoppingReceipt } from '@/contexts/ShoppingCartContext';
import { format, parseISO, isSameMonth, isSameYear } from 'date-fns';
import { LogReceiptModal } from './LogReceiptModal';

interface CartStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CartStatsModal = ({ isOpen, onClose }: CartStatsModalProps) => {
    const { receipts } = useShoppingCart();
    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [editingReceipt, setEditingReceipt] = useState<ShoppingReceipt | null>(null);

    const stats = useMemo(() => {
        let totalSpent = 0;
        let receiptCount = 0;
        let storeTotals: Record<string, number> = {};
        let categoryTotals: Record<string, number> = {};
        const includedReceipts: ShoppingReceipt[] = [];

        const isIncluded = (dateStr: string) => {
            const date = parseISO(dateStr);
            if (viewMode === 'month') return isSameMonth(date, selectedDate);
            return isSameYear(date, selectedDate);
        };

        receipts.forEach(receipt => {
            if (isIncluded(receipt.date)) {
                includedReceipts.push(receipt);
                totalSpent += receipt.totalAmount;
                receiptCount++;
                
                // Aggregate store
                storeTotals[receipt.storeName] = (storeTotals[receipt.storeName] || 0) + receipt.totalAmount;
                
                // Aggregate categories
                Object.entries(receipt.categoryBreakdown).forEach(([cat, amount]) => {
                    categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
                });
            }
        });

        const sortedStores = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]);
        const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

        return {
            totalSpent,
            receiptCount,
            sortedStores,
            sortedCategories,
            includedReceipts: includedReceipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
    }, [receipts, viewMode, selectedDate]);

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
                                <BarChart3 size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Shopping Statistics</h2>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Total Spent</span>
                                    <span className="text-3xl font-black text-gray-900">${stats.totalSpent.toFixed(2)}</span>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <TrendingUp size={24} />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Shopping Trips</span>
                                    <span className="text-3xl font-black text-gray-900">{stats.receiptCount}</span>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <ShoppingBag size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                                    <Store size={16} /> Top Stores
                                </h3>
                                <div className="space-y-3">
                                    {stats.sortedStores.length === 0 && <p className="text-sm text-gray-400 italic">No store data.</p>}
                                    {stats.sortedStores.map(([store, amount], i) => (
                                        <StatBar key={store} label={store} amount={amount} total={stats.totalSpent} color={['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500'][i % 5]} />
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                                    <PieChart size={16} /> Categories
                                </h3>
                                <div className="space-y-3">
                                    {stats.sortedCategories.length === 0 && <p className="text-sm text-gray-400 italic">No category data.</p>}
                                    {stats.sortedCategories.map(([cat, amount], i) => (
                                        <StatBar key={cat} label={cat} amount={amount} total={stats.totalSpent} color={['bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 'bg-rose-500', 'bg-cyan-500'][i % 5]} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recent Receipts List */}
                        <div className="mt-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                                <Receipt size={16} /> Recent Receipts
                            </h3>
                            <div className="space-y-3">
                                {stats.includedReceipts.length === 0 && <p className="text-sm text-gray-400 italic">No receipts found.</p>}
                                {stats.includedReceipts.map((receipt) => (
                                    <div key={receipt.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                        <div>
                                            <p className="font-semibold text-gray-900">{receipt.storeName}</p>
                                            <p className="text-xs text-gray-500">{format(parseISO(receipt.date), 'MMM d, yyyy')}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-gray-900">${receipt.totalAmount.toFixed(2)}</span>
                                            <button 
                                                onClick={() => setEditingReceipt(receipt)}
                                                className="text-primary-600 hover:text-primary-800 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
            
            {editingReceipt && (
                <LogReceiptModal 
                    isOpen={!!editingReceipt} 
                    onClose={() => setEditingReceipt(null)}
                    existingReceipt={editingReceipt}
                />
            )}
        </AnimatePresence>
    );
};

const StatBar = ({ label, amount, total, color }: { label: string, amount: number, total: number, color: string }) => {
    const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
    
    return (
        <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-700 truncate mr-2" title={label}>{label}</span>
                <span className="text-gray-900 whitespace-nowrap">${amount.toFixed(2)} <span className="text-gray-400 font-normal">({percentage}%)</span></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
};
