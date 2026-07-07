import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Check } from 'lucide-react';

interface ShareStoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableStores: string[];
    onShare: (store: string | 'all') => void;
}

export function ShareStoreModal({ isOpen, onClose, availableStores, onShare }: ShareStoreModalProps) {
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
                                    <Share2 size={20} />
                                </div>
                                <h2 className="text-lg font-black text-gray-900">Share Shopping List</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <p className="text-sm text-gray-500 mb-4 font-medium">Which list would you like to share?</p>
                            
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => onShare('all')}
                                    className="px-4 py-3 text-left bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-sm font-bold text-gray-700 rounded-xl transition-colors border border-transparent hover:border-primary-100 flex items-center justify-between group"
                                >
                                    <span>All Stores</span>
                                    <Check size={16} className="opacity-0 group-hover:opacity-100" />
                                </button>
                                
                                <div className="my-2 border-t border-gray-100"></div>
                                
                                {availableStores.map((store) => (
                                    <button
                                        key={store}
                                        onClick={() => onShare(store)}
                                        className="px-4 py-3 text-left bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-sm font-bold text-gray-700 rounded-xl transition-colors border border-transparent hover:border-primary-100 flex items-center justify-between group"
                                    >
                                        <span className="truncate">{store}</span>
                                        <Check size={16} className="opacity-0 group-hover:opacity-100 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
