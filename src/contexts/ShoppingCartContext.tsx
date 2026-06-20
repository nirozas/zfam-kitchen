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
}

interface ShoppingCartContextType {
    cartItems: CartItem[];
    addToCart: (item: Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string }) => void;
    addMultipleToCart: (items: (Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string })[]) => void;
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
                recipeIds: item.recipe_ids || [],
                recipeNames: item.recipe_names || []
            }));
            setCartItems(items);
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

    const addToCart = async (item: Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string }) => {
        await addMultipleToCart([item]);
    };

    const addMultipleToCart = async (newItems: (Omit<CartItem, 'id' | 'checked' | 'recipeIds' | 'recipeNames'> & { recipeId?: string, recipeName?: string })[]) => {
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
                i.week_id === item.weekId
            ) || itemsToInsert.find(i =>
                i.name.toLowerCase() === item.name.toLowerCase() &&
                i.unit.toLowerCase() === item.unit.toLowerCase() &&
                i.week_id === item.weekId
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
                    checked: false,
                    price: existingItem.price || 0,
                    note: existingItem.note || '',
                    purchase_url: item.purchaseUrl || existingItem.purchaseUrl || null,
                    recipe_ids: updatedRecipeIds,
                    recipe_names: updatedRecipeNames
                });
            } else {
                itemsToInsert.push({
                    user_id: user.id,
                    name: item.name,
                    amount: item.amount,
                    unit: item.unit,
                    week_id: item.weekId,
                    checked: false,
                    price: item.price || 0,
                    note: item.note || '',
                    purchase_url: item.purchaseUrl || null,
                    recipe_ids: item.recipeId ? [item.recipeId] : [],
                    recipe_names: item.recipeName ? [item.recipeName] : []
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
            .update({ checked: !item.checked })
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
                loading
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
