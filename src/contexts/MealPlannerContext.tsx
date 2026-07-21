import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Recipe, PlannerMeal } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface MealPlannerContextType {
    plannedMeals: Record<string, PlannerMeal[]>;
    dailyNotes: Record<string, string>;
    addRecipeToDate: (recipe: Recipe, dateStr: string) => Promise<boolean>;
    addCustomMealToDate: (title: string, dateStr: string) => Promise<boolean>;
    removeRecipeFromDate: (dateStr: string, index: number) => void;
    assignRecipeToMeal: (mealId: number | string, recipe: Recipe) => Promise<void>;
    updateMealNote: (dateStr: string, mealIndex: number, note: string) => Promise<void>;
    toggleMealCompleted: (dateStr: string, mealIndex: number) => Promise<void>;
    saveDailyNote: (dateStr: string, note: string) => Promise<void>;
    dailyExpenses: Record<string, { expense_amount: number; is_restaurant: boolean; restaurant_name: string }>;
    saveDailyExpense: (dateStr: string, expense: number, isRestaurant: boolean, restaurantName: string) => Promise<void>;
    moveRecipeToDate: (fromDate: string, mealIndex: number, toDate: string) => Promise<void>;
    copyWeekMeals: (fromDates: string[], toDates: string[]) => Promise<number>;
    rateMeal: (mealId: number | string, rating: number) => Promise<void>;
    refreshMealPlan: () => Promise<void>;
    loading: boolean;
}

const MealPlannerContext = createContext<MealPlannerContextType | undefined>(undefined);

export const MealPlannerProvider = ({ children }: { children: ReactNode }) => {
    const [plannedMeals, setPlannedMeals] = useState<Record<string, PlannerMeal[]>>({});
    const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
    const [dailyExpenses, setDailyExpenses] = useState<Record<string, { expense_amount: number; is_restaurant: boolean; restaurant_name: string }>>({});
    const [loading, setLoading] = useState(true);

    const fetchMealPlan = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setPlannedMeals({});
            setDailyNotes({});
            setDailyExpenses({});
            setLoading(false);
            return;
        }

        const [mealsResult, notesResult, expensesResult] = await Promise.all([
            supabase
                .from('meal_planner')
                .select('*, recipes(*, category:category_id(*), recipe_ingredients!recipe_id(*, ingredients(*)), recipe_tags(*, tags(*)))')
                .eq('user_id', user.id)
                .order('id', { ascending: true }),
            supabase
                .from('daily_notes')
                .select('date, note')
                .eq('user_id', user.id),
            supabase
                .from('daily_expenses')
                .select('date, expense_amount, is_restaurant, restaurant_name')
                .eq('user_id', user.id)
        ]);

        if (mealsResult.error) {
            console.error('Error fetching meal plan:', mealsResult.error, 'Details:', (mealsResult.error as any)?.details);
        } else if (mealsResult.data) {
            const grouped: Record<string, PlannerMeal[]> = {};
            mealsResult.data.forEach((item: any) => {
                const date = item.date;
                if (!grouped[date]) grouped[date] = [];

                if (item.custom_title) {
                    grouped[date].push({
                        id: item.id,
                        title: item.custom_title,
                        isCustom: true,
                        note: item.note || '',
                        completed: item.completed || false
                    });
                } else if (item.recipes) {
                    const rawRecipe = item.recipes;
                    const recipe: Recipe = {
                        ...rawRecipe,
                        ingredients: rawRecipe.recipe_ingredients.map((ri: any) => ({
                            ingredient: ri.ingredients,
                            amount_in_grams: ri.amount_in_grams,
                            unit: ri.unit
                        })),
                        category: rawRecipe.category,
                        tags: rawRecipe.recipe_tags.map((rt: any) => rt.tags)
                    };

                    grouped[date].push({
                        id: item.id, // Consistent use of meal_planner.id
                        title: recipe.title,
                        image_url: recipe.image_url || undefined,
                        recipe: recipe,
                        note: item.note || '',
                        completed: item.completed || false
                    });
                }
            });
            setPlannedMeals(grouped);
        }

        if (notesResult.error) {
            console.error('Error fetching notes:', notesResult.error);
        } else if (notesResult.data) {
            const notesMap: Record<string, string> = {};
            notesResult.data.forEach((item: any) => {
                notesMap[item.date] = item.note;
            });
            setDailyNotes(notesMap);
        }

        if (expensesResult.error) {
            console.error('Error fetching expenses:', expensesResult.error);
        } else if (expensesResult.data) {
            const expensesMap: Record<string, any> = {};
            expensesResult.data.forEach((item: any) => {
                expensesMap[item.date] = {
                    expense_amount: item.expense_amount,
                    is_restaurant: item.is_restaurant,
                    restaurant_name: item.restaurant_name
                };
            });
            setDailyExpenses(expensesMap);
        }

        setLoading(false);
    };

    // Load from Supabase on mount or auth change
    useEffect(() => {
        fetchMealPlan();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchMealPlan();
        });

        return () => subscription.unsubscribe();
    }, []);

    const addRecipeToDate = async (recipe: Recipe, dateStr: string): Promise<boolean> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("You must be signed in to add to your meal planner.");
            return false;
        }

        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Optimistic update
        setPlannedMeals(prev => ({
            ...prev,
            [dateStr]: [...(prev[dateStr] || []), {
                id: tempId,
                title: recipe.title,
                image_url: recipe.image_url || undefined,
                recipe: recipe,
                note: '',
                completed: false
            }]
        }));

        const { data, error } = await supabase
            .from('meal_planner')
            .insert({
                user_id: user.id,
                recipe_id: recipe.id,
                date: dateStr
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving meal to planner:', error);
            toast.error(`Could not add to planner: ${error.message}`);
            // Revert optimistic update
            setPlannedMeals(prev => ({
                ...prev,
                [dateStr]: (prev[dateStr] || []).filter(m => m.id !== tempId)
            }));
            return false;
        }

        if (data) {
            // Replace temporary ID
            setPlannedMeals(prev => {
                const meals = [...(prev[dateStr] || [])];
                const tmpIdx = meals.findIndex(m => m.id === tempId);
                if (tmpIdx !== -1) {
                    meals[tmpIdx] = { ...meals[tmpIdx], id: data.id };
                } else {
                    meals.push({
                        id: data.id,
                        title: recipe.title,
                        image_url: recipe.image_url || undefined,
                        recipe: recipe,
                        note: '',
                        completed: false
                    });
                }
                return { ...prev, [dateStr]: meals };
            });
            return true;
        }
        return false;
    };

    const addCustomMealToDate = async (title: string, dateStr: string): Promise<boolean> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("You must be signed in to add to your meal planner.");
            return false;
        }

        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Optimistic update
        setPlannedMeals(prev => ({
            ...prev,
            [dateStr]: [...(prev[dateStr] || []), {
                id: tempId,
                title: title,
                isCustom: true,
                note: '',
                completed: false
            }]
        }));

        const { data, error } = await supabase
            .from('meal_planner')
            .insert({
                user_id: user.id,
                custom_title: title,
                date: dateStr
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving custom meal to planner:', error);
            toast.error(`Could not add to planner: ${error.message}`);
            // Revert optimistic update
            setPlannedMeals(prev => ({
                ...prev,
                [dateStr]: (prev[dateStr] || []).filter(m => m.id !== tempId)
            }));
            return false;
        }

        if (data) {
            // Replace temporary ID
            setPlannedMeals(prev => {
                const meals = [...(prev[dateStr] || [])];
                const tmpIdx = meals.findIndex(m => m.id === tempId);
                if (tmpIdx !== -1) {
                    meals[tmpIdx] = { ...meals[tmpIdx], id: data.id };
                } else {
                    meals.push({
                        id: data.id,
                        title: title,
                        isCustom: true,
                        note: '',
                        completed: false
                    });
                }
                return { ...prev, [dateStr]: meals };
            });
            return true;
        }
        return false;
    };

    const removeRecipeFromDate = async (dateStr: string, index: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const recipeToRemove = plannedMeals[dateStr][index];

        // Optimistic update
        setPlannedMeals(prev => {
            const newMeals = [...(prev[dateStr] || [])];
            newMeals.splice(index, 1);
            return {
                ...prev,
                [dateStr]: newMeals
            };
        });

        // Delete from DB
        const { error } = await supabase
            .from('meal_planner')
            .delete()
            .eq('id', recipeToRemove.id);

        if (error) {
            console.error('Error removing meal from planner:', error);
        }
    };

    const assignRecipeToMeal = async (mealId: number | string, recipe: Recipe) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic update
        setPlannedMeals(prev => {
            const next = { ...prev };
            for (const date in next) {
                const idx = next[date].findIndex(m => m.id === mealId);
                if (idx !== -1) {
                    next[date] = [...next[date]];
                    next[date][idx] = {
                        ...next[date][idx],
                        id: mealId,
                        title: recipe.title,
                        image_url: recipe.image_url || undefined,
                        recipe: recipe
                    };
                    break;
                }
            }
            return next;
        });

        // Update DB
        const { error } = await supabase
            .from('meal_planner')
            .update({
                recipe_id: recipe.id,
                custom_title: null
            })
            .eq('id', mealId);

        if (error) {
            console.error('Error assigning recipe to meal:', error);
        }
    };

    const updateMealNote = async (dateStr: string, mealIndex: number, note: string) => {
        const meal = plannedMeals[dateStr][mealIndex];
        if (!meal) return;

        // Optimistic
        setPlannedMeals(prev => {
            const next = { ...prev };
            next[dateStr] = [...next[dateStr]];
            next[dateStr][mealIndex] = { ...next[dateStr][mealIndex], note };
            return next;
        });

        const { error } = await supabase
            .from('meal_planner')
            .update({ note })
            .eq('id', meal.id);

        if (error) console.error('Error updating meal note:', error);
    };

    const toggleMealCompleted = async (dateStr: string, mealIndex: number) => {
        const meal = plannedMeals[dateStr][mealIndex];
        if (!meal) return;

        const newCompleted = !meal.completed;

        // Optimistic
        setPlannedMeals(prev => {
            const next = { ...prev };
            next[dateStr] = [...next[dateStr]];
            next[dateStr][mealIndex] = { ...next[dateStr][mealIndex], completed: newCompleted };
            return next;
        });

        const { error } = await supabase
            .from('meal_planner')
            .update({ completed: newCompleted })
            .eq('id', meal.id);

        if (error) console.error('Error toggling meal completion:', error);
    };

    const saveDailyNote = async (dateStr: string, note: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic
        setDailyNotes(prev => ({ ...prev, [dateStr]: note }));

        if (!note.trim()) {
            // Delete if empty
            await supabase.from('daily_notes').delete().match({ user_id: user.id, date: dateStr });
        } else {
            // Upsert
            const { error } = await supabase.from('daily_notes').upsert({
                user_id: user.id,
                date: dateStr,
                note: note.trim()
            }, { onConflict: 'user_id,date' });

            if (error) console.error('Error saving note:', error);
        }
    };

    const saveDailyExpense = async (dateStr: string, expense: number, isRestaurant: boolean, restaurantName: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Optimistic
        setDailyExpenses(prev => ({
            ...prev,
            [dateStr]: { expense_amount: expense, is_restaurant: isRestaurant, restaurant_name: restaurantName }
        }));

        if (!expense && !isRestaurant && !restaurantName.trim()) {
            await supabase.from('daily_expenses').delete().match({ user_id: user.id, date: dateStr });
        } else {
            const { error } = await supabase.from('daily_expenses').upsert({
                user_id: user.id,
                date: dateStr,
                expense_amount: expense,
                is_restaurant: isRestaurant,
                restaurant_name: restaurantName.trim()
            }, { onConflict: 'user_id,date' });

            if (error) console.error('Error saving expense:', error);
        }
    };

    // ── NEW: Move a meal from one date to another (drag-and-drop) ──────────
    const moveRecipeToDate = async (fromDate: string, mealIndex: number, toDate: string) => {
        if (fromDate === toDate) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meal = plannedMeals[fromDate]?.[mealIndex];
        if (!meal) return;

        // Optimistic: remove from source, add to dest
        setPlannedMeals(prev => {
            const next = { ...prev };
            const fromMeals = [...(next[fromDate] || [])];
            const [moved] = fromMeals.splice(mealIndex, 1);
            next[fromDate] = fromMeals;
            next[toDate] = [...(next[toDate] || []), { ...moved }];
            return next;
        });

        // DB: update the date on that row
        const { error } = await supabase
            .from('meal_planner')
            .update({ date: toDate })
            .eq('id', meal.id);

        if (error) {
            console.error('Error moving meal:', error);
            // Revert
            setPlannedMeals(prev => {
                const next = { ...prev };
                const toMeals = [...(next[toDate] || [])];
                const movedBack = toMeals.pop();
                next[toDate] = toMeals;
                if (movedBack) {
                    const fromMeals = [...(next[fromDate] || [])];
                    fromMeals.splice(mealIndex, 0, movedBack);
                    next[fromDate] = fromMeals;
                }
                return next;
            });
        }
    };

    // ── NEW: Copy all meals from one set of dates to another (copy week) ────
    const copyWeekMeals = async (fromDates: string[], toDates: string[]): Promise<number> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        const inserts: any[] = [];
        const optimisticAdds: Array<{ date: string; meal: Omit<PlannerMeal, 'id'> }> = [];

        fromDates.forEach((fromDate, i) => {
            const toDate = toDates[i];
            const meals = plannedMeals[fromDate] || [];
            meals.forEach(meal => {
                if (meal.recipe) {
                    inserts.push({ user_id: user.id, date: toDate, recipe_id: meal.recipe.id });
                    optimisticAdds.push({
                        date: toDate,
                        meal: { title: meal.title, image_url: meal.image_url, recipe: meal.recipe, note: '', completed: false }
                    });
                } else if (meal.isCustom) {
                    inserts.push({ user_id: user.id, date: toDate, custom_title: meal.title });
                    optimisticAdds.push({
                        date: toDate,
                        meal: { title: meal.title, isCustom: true, note: '', completed: false }
                    });
                }
            });
        });

        if (inserts.length === 0) return 0;

        // Optimistic
        setPlannedMeals(prev => {
            const next = { ...prev };
            optimisticAdds.forEach(({ date, meal }) => {
                next[date] = [...(next[date] || []), { ...meal, id: `temp-copy-${Date.now()}-${Math.random()}` }];
            });
            return next;
        });

        const { data, error } = await supabase
            .from('meal_planner')
            .insert(inserts)
            .select();

        if (error) {
            console.error('Error copying week:', error);
            // Revert optimistic — full refresh is safest
            await fetchMealPlan();
            return 0;
        }

        // Replace temp IDs with real IDs from DB response
        if (data) {
            await fetchMealPlan();
        }

        return inserts.length;
    };

    // ── NEW: Rate a meal (1–5 stars, stored in meal_planner.rating) ─────────
    const rateMeal = async (mealId: number | string, rating: number) => {
        // Optimistic update
        setPlannedMeals(prev => {
            const next = { ...prev };
            for (const date in next) {
                const idx = next[date].findIndex(m => m.id === mealId);
                if (idx !== -1) {
                    next[date] = [...next[date]];
                    next[date][idx] = { ...next[date][idx], rating };
                    break;
                }
            }
            return next;
        });

        // Gracefully handle missing column
        const { error } = await supabase
            .from('meal_planner')
            .update({ rating })
            .eq('id', mealId);

        if (error) {
            // Column may not exist yet — silently skip, rating stays in memory
            console.warn('rateMeal DB error (column may not exist yet):', error.message);
        }
    };

    return (
        <MealPlannerContext.Provider value={{
            plannedMeals,
            dailyNotes,
            dailyExpenses,
            addRecipeToDate,
            addCustomMealToDate,
            removeRecipeFromDate,
            assignRecipeToMeal,
            updateMealNote,
            toggleMealCompleted,
            saveDailyNote,
            saveDailyExpense,
            moveRecipeToDate,
            copyWeekMeals,
            rateMeal,
            loading,
            refreshMealPlan: fetchMealPlan
        }}>
            {children}
        </MealPlannerContext.Provider>
    );
};

export const useMealPlanner = () => {
    const context = useContext(MealPlannerContext);
    if (!context) {
        throw new Error('useMealPlanner must be used within a MealPlannerProvider');
    }
    return context;
};
