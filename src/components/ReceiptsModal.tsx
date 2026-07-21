import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, ChevronDown, ChevronUp, Edit3, Trash2, Calendar, Store, Filter, ArrowDownUp } from 'lucide-react';
import { useShoppingCart, ShoppingReceipt } from '@/contexts/ShoppingCartContext';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isThisYear } from 'date-fns';
import { LogReceiptModal } from './LogReceiptModal';

interface ReceiptsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ReceiptsModal = ({ isOpen, onClose }: ReceiptsModalProps) => {
    const { receipts, removeReceipt } = useShoppingCart();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingReceipt, setEditingReceipt] = useState<ShoppingReceipt | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const filteredReceipts = useMemo(() => {
        return receipts.filter(receipt => {
            const date = parseISO(receipt.date);
            if (filterType === 'day') return isToday(date);
            if (filterType === 'week') return isThisWeek(date, { weekStartsOn: 1 });
            if (filterType === 'month') return isThisMonth(date);
            if (filterType === 'year') return isThisYear(date);
            return true;
        });
    }, [receipts, filterType]);

    const sortedReceipts = useMemo(() => {
        return [...filteredReceipts].sort((a, b) => {
            const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
            return sortOrder === 'desc' ? diff : -diff;
        });
    }, [filteredReceipts, sortOrder]);

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
                    className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[85vh]"
                >
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                <Receipt size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Receipts History</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap bg-white">
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                            <Filter size={16} className="text-gray-400 mr-1" />
                            {(['all', 'day', 'week', 'month', 'year'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-colors ${
                                        filterType === type 
                                            ? 'bg-primary-100 text-primary-700' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {type === 'all' ? 'All Time' : 
                                     type === 'day' ? 'Today' : 
                                     `This ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                        >
                            <ArrowDownUp size={14} />
                            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {sortedReceipts.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 flex flex-col items-center">
                                <Receipt size={48} className="text-gray-300 mb-4" />
                                <p className="font-medium text-lg">No receipts found</p>
                                <p className="text-sm">Log your shopping trips to see them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sortedReceipts.map(receipt => (
                                    <div key={receipt.id} className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                        <button
                                            onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                                            className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Store size={16} className="text-primary-500" />
                                                    <span className="font-bold text-gray-900">{receipt.storeName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                                    <Calendar size={14} />
                                                    <span>{format(parseISO(receipt.date), 'MMM d, yyyy')}</span>
                                                    <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 ml-1">Week {receipt.weekId}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <span className="font-black text-gray-900 text-lg">${receipt.totalAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-500">
                                                    {expandedId === receipt.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>
                                        </button>
                                        
                                        <AnimatePresence>
                                            {expandedId === receipt.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-gray-100 bg-white overflow-hidden"
                                                >
                                                    <div className="p-4">
                                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Items</h4>
                                                        <div className="space-y-2 mb-6">
                                                            {Object.entries(receipt.categoryBreakdown).length === 0 && (
                                                                <p className="text-sm text-gray-400 italic">No items logged.</p>
                                                            )}
                                                            {Object.entries(receipt.categoryBreakdown).map(([itemName, price]) => (
                                                                <div key={itemName} className="flex justify-between items-center text-sm">
                                                                    <span className="text-gray-700 font-medium">{itemName}</span>
                                                                    <span className="text-gray-900 font-semibold">${price.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('Are you sure you want to delete this receipt?')) {
                                                                        removeReceipt(receipt.id);
                                                                    }
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                            >
                                                                <Trash2 size={16} /> Delete
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingReceipt(receipt)}
                                                                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-primary-700 bg-primary-100 hover:bg-primary-200 rounded-lg transition-colors"
                                                            >
                                                                <Edit3 size={16} /> Edit Receipt
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}
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
