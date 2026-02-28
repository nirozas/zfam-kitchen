import { supabase } from './supabase';

export interface NutritionData {
    calories: number;
    protein: number;
}

/**
 * Calculates the total calories and macros for all recipes scheduled on a specific date.
 */
export async function calculateDailyNutrition(userId: string, date: string): Promise<NutritionData> {
    try {
        // Find all recipes scheduled for the given date
        const { data: plannerItems, error: plannerError } = await supabase
            .from('meal_planner')
            .select('recipe_id')
            .eq('user_id', userId)
            .eq('date', date);

        if (plannerError) throw plannerError;
        if (!plannerItems || plannerItems.length === 0) return { calories: 0, protein: 0 };

        const recipeIds = plannerItems.map(item => item.recipe_id);

        // Fetch ingredients for these recipes
        // This calculates macros correctly by extracting amounts
        const { data: recipeIngredients, error: riError } = await supabase
            .from('recipe_ingredients')
            .select(`
                amount_in_grams,
                ingredients (
                    calories_per_100g,
                    protein_per_100g
                )
            `)
            .in('recipe_id', recipeIds);

        if (riError) throw riError;

        let totalCalories = 0;
        let totalProtein = 0;

        recipeIngredients?.forEach((ri: any) => {
            if (ri.ingredients) {
                const ratio = ri.amount_in_grams / 100;
                totalCalories += ratio * (ri.ingredients.calories_per_100g || 0);
                totalProtein += ratio * (ri.ingredients.protein_per_100g || 0);
            }
        });

        return {
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein)
        };

    } catch (error) {
        console.error("Error calculating nutrition:", error);
        return { calories: 0, protein: 0 };
    }
}
