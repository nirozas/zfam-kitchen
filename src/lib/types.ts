import { Database } from './database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Ingredient = Database['public']['Tables']['ingredients']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];

// Recipe with joined data (as used in the UI)
type RecipeRow = Database['public']['Tables']['recipes']['Row'];

export interface Recipe extends Omit<RecipeRow, 'steps'> {
    // Inherited from Row: id, title, image_url, video_url, source_url, time_minutes, etc.
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    servings?: number;
    nutrition?: {
        calories: number;
        protein: number;
        fat: number;
        carbs: number;
    };
    ingredients: RecipeIngredient[];
    steps: Array<{ text: string; image_url?: string; alignment?: 'left' | 'center' | 'right' | 'full' }>;
    gallery_urls?: Array<{ url: string; caption?: string; alignment?: string }>;
    tags: Tag[]; // Joined tags
    category: Category; // Joined category
    author?: Database['public']['Tables']['profiles']['Row']; // Joined author
    rating: number; // User rating from 1 to 5 stars
}

export interface RecipeIngredient {
    ingredient: Ingredient;
    amount_in_grams: number;
    unit?: string; // 'g', 'ml', 'cup', 'lb', or 'pcs'
    group_name?: string;
}

export interface MealPlanEntry {
    id: number;
    date: string; // Database date string YYYY-MM-DD
    recipe?: Recipe;
    custom_title?: string | null;
}

export type PlannerMeal = {
    id: string | number;
    title: string;
    image_url?: string;
    isCustom?: boolean;
    recipe?: Recipe;
    custom_title?: string;
};
