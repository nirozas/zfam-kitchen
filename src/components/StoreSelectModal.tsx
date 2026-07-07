import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Check } from 'lucide-react';
import { useState } from 'react';

interface StoreSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (storeName: string) => void;
}

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

export function StoreSelectModal({ isOpen, onClose, onSelect }: StoreSelectModalProps) {
    const [customStore, setCustomStore] = useState('');

    const handleSelect = (store: string) => {
        onSelect(store);
        setCustomStore('');
        onClose();
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customStore.trim()) {
            handleSelect(customStore.trim());
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-3xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-100 text-primary-600 rounded-xl">
                                    <Store size={20} />
                                </div>
                                <h2 className="text-lg font-black text-gray-900">Select Store</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <p className="text-sm text-gray-500 mb-4 font-medium">Which store will you buy these items from?</p>
                            
                            <div className="grid grid-cols-2 gap-2 mb-6">
                                {COMMON_STORES.map((store) => (
                                    <button
                                        key={store}
                                        onClick={() => handleSelect(store)}
                                        className="px-3 py-2 text-left bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-sm font-bold text-gray-700 rounded-xl transition-colors border border-transparent hover:border-primary-100 flex items-center justify-between group"
                                    >
                                        <span className="truncate">{store}</span>
                                        <Check size={14} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="px-2 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-wider">Or enter custom</span>
                                </div>
                            </div>

                            <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
                                <input
                                    type="text"
                                    value={customStore}
                                    onChange={(e) => setCustomStore(e.target.value)}
                                    placeholder="e.g. Target"
                                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={!customStore.trim()}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Add
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
