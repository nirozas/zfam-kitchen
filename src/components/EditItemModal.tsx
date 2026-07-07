import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Edit3 } from 'lucide-react';
import { useShoppingCart, CartItem } from '@/contexts/ShoppingCartContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: CartItem | null;
}

export const EditItemModal = ({ isOpen, onClose, item }: EditItemModalProps) => {
    const { updateItem } = useShoppingCart();
    const [name, setName] = useState('');
    const [amount, setAmount] = useState(1);
    const [unit, setUnit] = useState('unit');
    const [price, setPrice] = useState<string>('');
    const [storeName, setStoreName] = useState('Unassigned');
    const [weekId, setWeekId] = useState('');
    const [purchasedAt, setPurchasedAt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (item && isOpen) {
            setName(item.name);
            setAmount(item.amount);
            setUnit(item.unit);
            setPrice(item.price ? item.price.toString() : '');
            setStoreName(item.storeName || 'Unassigned');
            setWeekId(item.weekId);
            if (item.purchasedAt) {
                setPurchasedAt(format(new Date(item.purchasedAt), "yyyy-MM-dd'T'HH:mm"));
            } else {
                setPurchasedAt('');
            }
        }
    }, [item, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item) return;

        setIsSubmitting(true);
        try {
            const updates: Partial<CartItem> = {
                name: name.trim(),
                amount: amount,
                unit: unit.trim(),
                storeName: storeName.trim() || 'Unassigned',
                weekId: weekId.trim()
            };

            const parsedPrice = parseFloat(price);
            if (!isNaN(parsedPrice)) {
                updates.price = parsedPrice;
            } else if (price === '') {
                updates.price = 0;
            }

            if (purchasedAt) {
                updates.purchasedAt = new Date(purchasedAt).toISOString();
            } else if (item.checked) {
                updates.purchasedAt = null;
            }

            await updateItem(item.id, updates);
            toast.success("Item updated successfully");
            onClose();
        } catch (error) {
            toast.error("Failed to update item");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !item) return null;

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
                    className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-auto overflow-hidden flex flex-col"
                >
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                <Edit3 size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Edit Item</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={amount}
                                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Unit</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Store</label>
                                <datalist id="store-suggestions">
                                    <option value="Walmart" />
                                    <option value="Safeway" />
                                    <option value="Costco" />
                                    <option value="Real Produce" />
                                    <option value="Amazon" />
                                    <option value="Smart&Final" />
                                    <option value="Trader Joe's" />
                                    <option value="Whole Foods" />
                                </datalist>
                                <input
                                    type="text"
                                    list="store-suggestions"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Price ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Week Assigned</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="YYYY-WW"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={weekId}
                                    onChange={(e) => setWeekId(e.target.value)}
                                />
                            </div>
                            {item.checked && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Purchased At</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                                        value={purchasedAt}
                                        onChange={(e) => setPurchasedAt(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            <Save size={20} />
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
