import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Recipe, PlannerMeal } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface MealPlannerContextType {
    plannedMeals: Record<string, PlannerMeal[]>;
    dailyNotes: Record<string, string>;
    addRecipeToDate: (recipe: Recipe, dateStr: string) => void;
    addCustomMealToDate: (title: string, dateStr: string) => void;
    removeRecipeFromDate: (dateStr: string, index: number) => void;
    assignRecipeToMeal: (mealId: number | string, recipe: Recipe) => Promise<void>;
    updateMealNote: (dateStr: string, mealIndex: number, note: string) => Promise<void>;
    toggleMealCompleted: (dateStr: string, mealIndex: number) => Promise<void>;
    saveDailyNote: (dateStr: string, note: string) => Promise<void>;
    refreshMealPlan: () => Promise<void>;
    loading: boolean;
}

const MealPlannerContext = createContext<MealPlannerContextType | undefined>(undefined);

export const MealPlannerProvider = ({ children }: { children: ReactNode }) => {
    const [plannedMeals, setPlannedMeals] = useState<Record<string, PlannerMeal[]>>({});
    const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fetchMealPlan = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setPlannedMeals({});
            setDailyNotes({});
            setLoading(false);
            return;
        }

        const [mealsResult, notesResult] = await Promise.all([
            supabase
                .from('meal_planner')
                .select('*, recipes(*, categories(*), recipe_ingredients(*, ingredients(*)), recipe_tags(*, tags(*)))')
                .eq('user_id', user.id)
                .order('id', { ascending: true }),
            supabase
                .from('daily_notes')
                .select('date, note')
                .eq('user_id', user.id)
        ]);

        if (mealsResult.error) {
            console.error('Error fetching meal plan:', mealsResult.error);
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
                        category: rawRecipe.categories,
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

    const addRecipeToDate = async (recipe: Recipe, dateStr: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
            return;
        }

        if (data) {
            setPlannedMeals(prev => ({
                ...prev,
                [dateStr]: [...(prev[dateStr] || []), {
                    id: data.id,
                    title: recipe.title,
                    image_url: recipe.image_url || undefined,
                    recipe: recipe,
                    note: '',
                    completed: false
                }]
            }));
        }
    };

    const addCustomMealToDate = async (title: string, dateStr: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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
            return;
        }

        if (data) {
            setPlannedMeals(prev => ({
                ...prev,
                [dateStr]: [...(prev[dateStr] || []), {
                    id: data.id,
                    title: title,
                    isCustom: true,
                    note: '',
                    completed: false
                }]
            }));
        }
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

    return (
        <MealPlannerContext.Provider value={{
            plannedMeals,
            dailyNotes,
            addRecipeToDate,
            addCustomMealToDate,
            removeRecipeFromDate,
            assignRecipeToMeal,
            updateMealNote,
            toggleMealCompleted,
            saveDailyNote,
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
