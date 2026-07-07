import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Plus, Trash2 } from 'lucide-react';
import { useShoppingCart, getWeekId, ShoppingReceipt } from '@/contexts/ShoppingCartContext';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

interface LogReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingReceipt?: ShoppingReceipt | null;
}

export const LogReceiptModal = ({ isOpen, onClose, existingReceipt }: LogReceiptModalProps) => {
    const { addReceipt, updateReceipt } = useShoppingCart();
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [storeName, setStoreName] = useState('');
    const [items, setItems] = useState<{ name: string, amount: string, price: string }[]>([
        { name: '', amount: '1 unit', price: '' }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showBulkAdd, setShowBulkAdd] = useState(false);
    const [bulkText, setBulkText] = useState('');

    useEffect(() => {
        if (isOpen && existingReceipt) {
            setDate(existingReceipt.date);
            setStoreName(existingReceipt.storeName);
            const loadedItems = Object.entries(existingReceipt.categoryBreakdown).map(([name, price]) => ({
                name,
                amount: '1 unit',
                price: price.toString()
            }));
            setItems(loadedItems.length > 0 ? loadedItems : [{ name: '', amount: '1 unit', price: '' }]);
        } else if (isOpen && !existingReceipt) {
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setStoreName('');
            setItems([{ name: '', amount: '1 unit', price: '' }]);
        }
    }, [isOpen, existingReceipt]);

    const handleAddItem = () => {
        setItems([...items, { name: '', amount: '1 unit', price: '' }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: 'name' | 'amount' | 'price', value: string) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleBulkParse = () => {
        const lines = bulkText.split('\n');
        const newItems: {name: string, amount: string, price: string}[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const priceMatch = trimmed.match(/\$?(\d+(?:\.\d{2})?)$/);
            if (priceMatch) {
                const price = priceMatch[1];
                const rest = trimmed.slice(0, -priceMatch[0].length).trim();
                
                const amountMatch = rest.match(/(\d+(?:\.\d+)?\s*(?:lbs?|oz|kg|g|gal|dz|bunch|units?|items?|pcs?|pk|packs?|boxes?|bags?|cans?|jars?|bottles?)?)$/i);
                let amount = '1 unit';
                let name = rest;
                
                if (amountMatch) {
                    amount = amountMatch[1];
                    name = rest.slice(0, -amountMatch[0].length).trim();
                }
                
                if (name) {
                    newItems.push({ name, amount, price });
                }
            }
        }
        
        if (newItems.length > 0) {
            const updatedItems = items.length === 1 && !items[0].name && !items[0].price ? newItems : [...items, ...newItems];
            setItems(updatedItems);
            setBulkText('');
            setShowBulkAdd(false);
            toast.success(`Added ${newItems.length} items`);
        } else {
            toast.error("Could not parse any items. Format: [Name] [Amount] [Price]");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!storeName.trim()) {
            toast.error("Store name is required");
            return;
        }
        if (!date) {
            toast.error("Date is required");
            return;
        }

        const breakdown: Record<string, number> = {};
        const parsedItems: { name: string, amount: string, price: number }[] = [];
        let total = 0;
        
        for (const item of items) {
            const name = item.name.trim();
            const price = parseFloat(item.price);
            const amount = item.amount.trim() || '1 unit';
            
            if (name && !isNaN(price) && price > 0) {
                breakdown[name] = (breakdown[name] || 0) + price;
                parsedItems.push({ name, amount, price });
                total += price;
            }
        }

        if (total === 0) {
            toast.error("Please enter at least one valid item with a price");
            return;
        }

        setIsSubmitting(true);
        try {
            if (existingReceipt) {
                await updateReceipt(existingReceipt.id, {
                    date,
                    weekId: getWeekId(parseISO(date)),
                    storeName: storeName.trim(),
                    totalAmount: total,
                    categoryBreakdown: breakdown,
                    // Note: We might NOT want to re-add items to cart on edit to avoid duplication,
                    // but if they added new items, they wouldn't sync. We'll skip sending items to cart on edit.
                    items: undefined 
                }, {
                    weekId: existingReceipt.weekId,
                    storeName: existingReceipt.storeName,
                    itemNames: Object.keys(existingReceipt.categoryBreakdown)
                });
                toast.success("Receipt updated successfully!");
            } else {
                await addReceipt({
                    date,
                    weekId: getWeekId(parseISO(date)),
                    storeName: storeName.trim(),
                    totalAmount: total,
                    categoryBreakdown: breakdown,
                    items: parsedItems
                });
                toast.success("Receipt logged and items added to cart!");
            }
            onClose();
        } catch (error) {
            toast.error("Failed to save receipt");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const currentTotal = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

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
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                <Receipt size={20} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{existingReceipt ? 'Edit Receipt' : 'Log Shopping Receipt'}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Store Name</label>
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
                                    required
                                    placeholder="e.g. Walmart"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Items</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkAdd(!showBulkAdd)}
                                        className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-2 py-1 rounded-md transition-colors"
                                    >
                                        {showBulkAdd ? "Manual Entry" : "Bulk Paste"}
                                    </button>
                                </div>
                                <span className="text-sm font-black text-primary-600">Total: ${currentTotal.toFixed(2)}</span>
                            </div>

                            {showBulkAdd ? (
                                <div className="flex flex-col gap-3">
                                    <p className="text-xs text-gray-500">Paste your receipt text below. Format: <code>[Item Name] [Amount] [Price]</code>. Example: <code>Apples 2 lbs 3.99</code></p>
                                    <textarea
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                        placeholder="Apples 2 lbs 3.99&#10;Milk 1 gal 4.50&#10;Bread 2.99"
                                        className="w-full h-40 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBulkParse}
                                        className="self-end bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Parse Items
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                {items.map((item, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Item Name"
                                            required
                                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                            value={item.name}
                                            onChange={(e) => handleItemChange(i, 'name', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Amount (e.g., 2 lbs)"
                                            required
                                            className="w-32 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                            value={item.amount}
                                            onChange={(e) => handleItemChange(i, 'amount', e.target.value)}
                                        />
                                        <div className="relative w-28">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                required
                                                placeholder="Price"
                                                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                                                value={item.price}
                                                onChange={(e) => handleItemChange(i, 'price', e.target.value)}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(i)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!showBulkAdd && (
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="mt-3 flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-bold hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-all text-sm"
                            >
                                <Plus size={16} />
                                Add Another Item
                            </button>
                        )}
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2.5 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Save Receipt'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
