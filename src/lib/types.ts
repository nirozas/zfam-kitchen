import { Database } from './database.types';

export type Category = Database['public']['Tables']['categories']['Row'];
export type Ingredient = Database['public']['Tables']['ingredients']['Row'];
export type Tag = Database['public']['Tables']['tags']['Row'];

// Recipe with joined data (as used in the UI)
type RecipeRow = Database['public']['Tables']['recipes']['Row'];

export interface Recipe extends Omit<RecipeRow, 'steps' | 'prep_time_minutes' | 'cook_time_minutes' | 'servings' | 'nutrition' | 'gallery_urls' | 'rating' | 'notes'> {
    // Inherited from Row: id, slug, title, image_url, video_url, source_url, time_minutes, etc.
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
    steps: Array<{ text: string; image_url?: string; alignment?: 'left' | 'center' | 'right' | 'full'; group_name?: string }>;
    gallery_urls?: Array<{ url: string; caption?: string; alignment?: string }>;
    tags: Tag[]; // Joined tags
    category: Category; // Main Joined category
    all_categories?: Category[]; // All associated categories
    country_origin?: string;
    notes?: string;
    author?: Database['public']['Tables']['profiles']['Row']; // Joined author
    rating: number; // User rating from 1 to 5 stars
    likesCount?: number; // Pre-fetched likes count
}

export interface RecipeIngredient {
    ingredient: Ingredient;
    amount_in_grams: number;
    unit?: string; // 'g', 'ml', 'cup', 'lb', or 'pcs'
    group_name?: string;
    note?: string;
}

export interface MealPlanEntry {
    id: number;
    date: string; // Database date string YYYY-MM-DD
    recipe?: Recipe;
    custom_title?: string | null;
    note?: string | null;
    completed?: boolean;
}

export type PlannerMeal = {
    id: string | number;
    title: string;
    image_url?: string;
    isCustom?: boolean;
    recipe?: Recipe;
    custom_title?: string;
    note?: string;
    completed?: boolean;
};

// Album Layouts Types
export interface LayoutSlot {
    id: string;
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage (0-100)
    height: number; // percentage (0-100)
    borderRadius?: string; // CSS valid unit e.g., '8px'
}

export interface AlbumLayoutConfig {
    name: string;
    columns: number;
    gap?: number;
    slots: LayoutSlot[];
}

export interface AlbumLayout {
    id: string;
    name: string;
    config: AlbumLayoutConfig; // Mapped from the JSONB column
}
