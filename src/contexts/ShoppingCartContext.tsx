import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface CartItem {
    id: string;
    name: string;
    amount: number;
    unit: string;
    recipeIds: string[]; // Support merging multiple recipes
    recipeNames: string[]; // Support merging multiple recipes
    checked: boolean;
    weekId: string; // Format: "YYYY-WW" (ISO week number)
    price?: number; // Price for this specific item (user can enter manually)
    note?: string; // Optional user note
    purchaseUrl?: string | null; // Added purchase link
    storeName?: string; // Added store name
    purchasedAt?: string | null; // Added purchased timestamp
}

export interface ShoppingReceipt {
    id: string;
    date: string;
    weekId: string;
    storeName: string;
    totalAmount: number;
    categoryBreakdown: Record<string, number>;
}

interface ShoppingCartContextType {
    cartItems: CartItem[];
    addToCart: (item: Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string, checked?: boolean, purchasedAt?: string | null }) => void;
    addMultipleToCart: (items: (Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string, checked?: boolean, purchasedAt?: string | null })[]) => void;
    removeFromCart: (id: string) => void;
    toggleChecked: (id: string) => void;
    clearCart: () => void;
    clearWeek: (weekId: string) => void;
    updateQuantity: (id: string, amount: number) => void;
    updatePrice: (id: string, price: number) => void;
    updateNote: (id: string, note: string) => void;
    getWeeklyCart: (weekId: string) => CartItem[];
    getWeeklyTotal: (weekId: string) => number;
    getAllWeeks: () => string[];
    cartCount: number;
    loading: boolean;
    receipts: ShoppingReceipt[];
    addReceipt: (receipt: Omit<ShoppingReceipt, 'id'> & { items?: { name: string, amount: string, price: number }[] }) => Promise<void>;
    updateReceipt: (id: string, updates: Partial<Omit<ShoppingReceipt, 'id'> & { items?: { name: string, amount: string, price: number }[] }>, oldData?: { weekId: string, storeName: string, itemNames: string[] }) => Promise<void>;
    updateItem: (id: string, updates: Partial<CartItem>) => Promise<void>;
    removeReceipt: (id: string) => Promise<void>;
}

// Utility: Get ISO week number from date
export function getWeekId(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

// Utility: Get current week ID
export function getCurrentWeekId(): string {
    return getWeekId(new Date());
}

const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

export const ShoppingCartProvider = ({ children }: { children: ReactNode }) => {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [receipts, setReceipts] = useState<ShoppingReceipt[]>([]);
    const [loading, setLoading] = useState(true);

    // Load from Supabase
    const fetchCart = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setCartItems([]);
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('shopping_cart')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching cart:', error);
        } else if (data) {
            const items: CartItem[] = data.map((item: any) => ({
                id: item.id,
                name: item.name,
                amount: parseFloat(item.amount),
                unit: item.unit,
                weekId: item.week_id,
                checked: item.checked,
                price: parseFloat(item.price || 0),
                note: item.note || '',
                purchaseUrl: item.purchase_url || null,
                storeName: item.store_name || 'Unassigned',
                recipeIds: item.recipe_ids || [],
                recipeNames: item.recipe_names || []
            }));
            setCartItems(items);
        }

        const { data: receiptData, error: receiptError } = await supabase
            .from('shopping_receipts')
            .select('*')
            .eq('user_id', user.id);

        if (receiptError) {
            console.error('Error fetching receipts:', receiptError);
        } else if (receiptData) {
            const parsedReceipts = receiptData.map((r: any) => ({
                id: r.id,
                date: r.date,
                weekId: r.week_id,
                storeName: r.store_name,
                totalAmount: parseFloat(r.total_amount),
                categoryBreakdown: typeof r.category_breakdown === 'string' ? JSON.parse(r.category_breakdown) : (r.category_breakdown || {})
            }));
            setReceipts(parsedReceipts);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchCart();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchCart();
        });
        return () => subscription.unsubscribe();
    }, []);

    const addToCart = async (item: Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string, checked?: boolean, purchasedAt?: string | null }) => {
        await addMultipleToCart([item]);
    };

    const addMultipleToCart = async (newItems: (Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string, checked?: boolean, purchasedAt?: string | null })[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch latest cart items to ensure we have the most current state for merging
        const { data: currentItemsRaw } = await supabase
            .from('shopping_cart')
            .select('*')
            .eq('user_id', user.id);

        const currentItems: CartItem[] = (currentItemsRaw || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            amount: parseFloat(item.amount),
            unit: item.unit,
            weekId: item.week_id,
            checked: item.checked,
            price: parseFloat(item.price || 0),
            note: item.note || '',
            purchaseUrl: item.purchase_url || null,
            storeName: item.store_name || 'Unassigned',
            purchasedAt: item.purchased_at || null,
            recipeIds: item.recipe_ids || [],
            recipeNames: item.recipe_names || []
        }));

        const itemsToUpdate: any[] = [];
        const itemsToInsert: any[] = [];

        for (const item of newItems) {
            // Check if item already in our update/insert batch
            const existingInBatch = itemsToUpdate.find(i =>
                i.name.toLowerCase() === item.name.toLowerCase() &&
                i.unit.toLowerCase() === item.unit.toLowerCase() &&
                i.week_id === item.weekId &&
                i.store_name === (item.storeName || 'Unassigned')
            ) || itemsToInsert.find(i =>
                i.name.toLowerCase() === item.name.toLowerCase() &&
                i.unit.toLowerCase() === item.unit.toLowerCase() &&
                i.week_id === item.weekId &&
                i.store_name === (item.storeName || 'Unassigned')
            );

            if (existingInBatch) {
                existingInBatch.amount += item.amount;
                if (item.purchaseUrl) existingInBatch.purchase_url = item.purchaseUrl; // Prefer latest purchase url
                if (item.recipeId && !existingInBatch.recipe_ids.includes(item.recipeId)) {
                    existingInBatch.recipe_ids.push(item.recipeId);
                    if (item.recipeName) existingInBatch.recipe_names.push(item.recipeName);
                }
                continue;
            }

            // Check for existing item in DB state to merge
            const existingItem = currentItems.find(i =>
                i.name.toLowerCase() === item.name.toLowerCase() &&
                i.unit.toLowerCase() === item.unit.toLowerCase() &&
                i.weekId === item.weekId &&
                i.storeName === (item.storeName || 'Unassigned') &&
                !i.checked
            );

            if (existingItem) {
                const updatedRecipeIds = item.recipeId && !existingItem.recipeIds.includes(item.recipeId)
                    ? [...existingItem.recipeIds, item.recipeId]
                    : existingItem.recipeIds;

                const updatedRecipeNames = item.recipeName && !existingItem.recipeNames.includes(item.recipeName)
                    ? [...existingItem.recipeNames, item.recipeName]
                    : existingItem.recipeNames;

                itemsToUpdate.push({
                    id: existingItem.id,
                    user_id: user.id,
                    name: existingItem.name,
                    amount: existingItem.amount + item.amount,
                    unit: existingItem.unit,
                    week_id: existingItem.weekId,
                    checked: item.checked ?? false,
                    price: item.price || existingItem.price || 0,
                    note: existingItem.note || '',
                    purchase_url: item.purchaseUrl || existingItem.purchaseUrl || null,
                    store_name: existingItem.storeName,
                    recipe_ids: updatedRecipeIds,
                    recipe_names: updatedRecipeNames,
                    purchased_at: item.purchasedAt ?? existingItem.purchasedAt ?? null
                });
            } else {
                itemsToInsert.push({
                    user_id: user.id,
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    week_id: item.weekId,
                    checked: item.checked ?? false,
                    price: item.price || 0,
                    note: item.note || '',
                    purchase_url: item.purchaseUrl || null,
                    store_name: item.storeName || 'Unassigned',
                    recipe_ids: item.recipeId ? [item.recipeId] : [],
                    recipe_names: item.recipeName ? [item.recipeName] : [],
                    purchased_at: item.purchasedAt ?? null
                });
            }
        }

        // Perform updates and inserts
        if (itemsToUpdate.length > 0) {
            await supabase.from('shopping_cart').upsert(itemsToUpdate);
        }
        if (itemsToInsert.length > 0) {
            await supabase.from('shopping_cart').insert(itemsToInsert);
        }

        fetchCart();
    };

    const removeFromCart = async (id: string) => {
        const { error } = await supabase.from('shopping_cart').delete().eq('id', id);
        if (!error) fetchCart();
    };

    const toggleChecked = async (id: string) => {
        const item = cartItems.find(i => i.id === id);
        if (!item) return;

        const { error } = await supabase
            .from('shopping_cart')
            .update({ 
                checked: !item.checked,
                purchased_at: !item.checked ? new Date().toISOString() : null
            })
            .eq('id', id);

        if (!error) fetchCart();
    };

    const clearCart = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from('shopping_cart').delete().eq('user_id', user.id);
        if (!error) fetchCart();
    };

    const clearWeek = async (weekId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase
            .from('shopping_cart')
            .delete()
            .match({ user_id: user.id, week_id: weekId });
        if (!error) fetchCart();
    };

    const updateQuantity = async (id: string, amount: number) => {
        const { error } = await supabase
            .from('shopping_cart')
            .update({ amount })
            .eq('id', id);
        if (!error) fetchCart();
    };

    const updatePrice = async (id: string, price: number) => {
        const { error } = await supabase
            .from('shopping_cart')
            .update({ price })
            .eq('id', id);
        if (!error) fetchCart();
    };

    const updateNote = async (id: string, note: string) => {
        const { error } = await supabase
            .from('shopping_cart')
            .update({ note })
            .eq('id', id);
        if (!error) fetchCart();
    };

    const getWeeklyCart = (weekId: string): CartItem[] => {
        return cartItems.filter(item => item.weekId === weekId);
    };

    const getWeeklyTotal = (weekId: string): number => {
        return cartItems
            .filter(item => item.weekId === weekId)
            .reduce((total, item) => total + (item.price || 0), 0);
    };

    const getAllWeeks = (): string[] => {
        const weeks = new Set(cartItems.map(item => item.weekId));
        return Array.from(weeks).sort();
    };

    const cartCount = cartItems.filter(item => !item.checked).length;

    const addReceipt = async (receipt: Omit<ShoppingReceipt, 'id'> & { items?: { name: string, amount: string, price: number }[] }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('shopping_receipts').insert({
            user_id: user.id,
            date: receipt.date,
            week_id: receipt.weekId,
            store_name: receipt.storeName,
            total_amount: receipt.totalAmount,
            category_breakdown: receipt.categoryBreakdown
        });

        if (error) {
            console.error('Error adding receipt:', error);
        } else {
            // Add items to cart if provided
            if (receipt.items && receipt.items.length > 0) {
                const cartItemsToAdd = receipt.items.map(item => {
                    // Try to parse amount and unit (e.g. "2 lbs" -> amount 2, unit "lbs")
                    const match = item.amount.match(/^([\d.]+)\s*(.*)$/);
                    let amt = 1;
                    let unit = 'unit';
                    if (match) {
                        amt = parseFloat(match[1]) || 1;
                        unit = match[2] || 'unit';
                    } else if (item.amount) {
                        unit = item.amount;
                    }

                    return {
                        name: item.name,
                        amount: amt,
                        unit: unit,
                        weekId: receipt.weekId,
                        storeName: receipt.storeName,
                        price: item.price,
                        checked: true,
                        purchasedAt: new Date().toISOString()
                    };
                });
                await addMultipleToCart(cartItemsToAdd);
            }
            fetchCart(); // Refetch everything
        }
    };

    const updateReceipt = async (id: string, updates: Partial<Omit<ShoppingReceipt, 'id'> & { items?: { name: string, amount: string, price: number }[] }>, oldData?: { weekId: string, storeName: string, itemNames: string[] }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const dbUpdates: any = {};
        if (updates.date !== undefined) dbUpdates.date = updates.date;
        if (updates.weekId !== undefined) dbUpdates.week_id = updates.weekId;
        if (updates.storeName !== undefined) dbUpdates.store_name = updates.storeName;
        if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
        if (updates.categoryBreakdown !== undefined) dbUpdates.category_breakdown = updates.categoryBreakdown;

        if (Object.keys(dbUpdates).length > 0) {
            const { error } = await supabase
                .from('shopping_receipts')
                .update(dbUpdates)
                .eq('id', id);

            if (error) {
                console.error('Error updating receipt:', error);
                return;
            }

            // Move existing cart items if weekId or storeName changed
            if (oldData && (updates.weekId || updates.storeName)) {
                const newWeekId = updates.weekId || oldData.weekId;
                const newStoreName = updates.storeName || oldData.storeName;

                if (newWeekId !== oldData.weekId || newStoreName !== oldData.storeName) {
                    const matchingItems = cartItems.filter(item => 
                        item.weekId === oldData.weekId && 
                        item.storeName === oldData.storeName && 
                        oldData.itemNames.includes(item.name)
                    );

                    if (matchingItems.length > 0) {
                        for (const item of matchingItems) {
                            await supabase
                                .from('shopping_cart')
                                .update({
                                    week_id: newWeekId,
                                    store_name: newStoreName
                                })
                                .eq('id', item.id);
                        }
                    }
                }
            }
        }

        // Add items to cart if provided
        if (updates.items && updates.items.length > 0) {
            const cartItemsToAdd = updates.items.map(item => {
                const match = item.amount.match(/^([\d.]+)\s*(.*)$/);
                let amt = 1;
                let unit = 'unit';
                if (match) {
                    amt = parseFloat(match[1]) || 1;
                    unit = match[2] || 'unit';
                } else if (item.amount) {
                    unit = item.amount;
                }
                return {
                    name: item.name,
                    amount: amt,
                    unit: unit,
                    weekId: updates.weekId || getWeekId(new Date()),
                    storeName: updates.storeName || 'Unassigned',
                    price: item.price,
                    checked: true,
                    purchasedAt: new Date().toISOString()
                };
            });
            await addMultipleToCart(cartItemsToAdd);
        }

        fetchCart();
    };

    const updateItem = async (id: string, updates: Partial<CartItem>) => {
        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
        if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
        if (updates.weekId !== undefined) dbUpdates.week_id = updates.weekId;
        if (updates.checked !== undefined) dbUpdates.checked = updates.checked;
        if (updates.price !== undefined) dbUpdates.price = updates.price;
        if (updates.storeName !== undefined) dbUpdates.store_name = updates.storeName;
        if (updates.purchasedAt !== undefined) dbUpdates.purchased_at = updates.purchasedAt;

        const { error } = await supabase
            .from('shopping_cart')
            .update(dbUpdates)
            .eq('id', id);

        if (!error) fetchCart();
    };

    const removeReceipt = async (id: string) => {
        const { error } = await supabase.from('shopping_receipts').delete().eq('id', id);
        if (error) {
            console.error('Error removing receipt:', error);
        } else {
            fetchCart();
        }
    };

    return (
        <ShoppingCartContext.Provider
            value={{
                cartItems,
                addToCart,
                addMultipleToCart,
                removeFromCart,
                toggleChecked,
                clearCart,
                clearWeek,
                updateQuantity,
                updatePrice,
                updateNote,
                getWeeklyCart,
                getWeeklyTotal,
                getAllWeeks,
                cartCount,
                loading,
                receipts,
                addReceipt,
                updateReceipt,
                removeReceipt,
                updateItem
            }}
        >
            {children}
        </ShoppingCartContext.Provider>
    );
};

export const useShoppingCart = () => {
    const context = useContext(ShoppingCartContext);
    if (!context) {
        throw new Error('useShoppingCart must be used within ShoppingCartProvider');
    }
    return context;
};
