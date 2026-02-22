export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    username: string | null
                    avatar_url: string | null
                    updated_at: string | null
                    is_approved: boolean
                    role: 'user' | 'admin'
                }
                Insert: {
                    id: string
                    username?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                    is_approved?: boolean
                    role?: 'user' | 'admin'
                }
                Update: {
                    id?: string
                    username?: string | null
                    avatar_url?: string | null
                    updated_at?: string | null
                    is_approved?: boolean
                    role?: 'user' | 'admin'
                }
            }
            categories: {
                Row: {
                    id: number
                    name: string
                    slug: string
                    image_url: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    name: string
                    slug: string
                    image_url?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    name?: string
                    slug?: string
                    image_url?: string | null
                    created_at?: string | null
                }
            }
            recipes: {
                Row: {
                    id: string
                    author_id: string | null
                    category_id: number | null
                    title: string
                    image_url: string | null
                    video_url: string | null
                    source_url: string | null
                    time_minutes: number
                    description: string | null
                    steps: string[]
                    created_at: string | null
                    updated_at: string | null
                    rating: number | null
                }
                Insert: {
                    id?: string
                    author_id?: string | null
                    category_id?: number | null
                    title: string
                    image_url?: string | null
                    video_url?: string | null
                    time_minutes?: number
                    description?: string | null
                    steps: string[]
                    created_at?: string | null
                    updated_at?: string | null
                    rating?: number | null
                }
                Update: {
                    id?: string
                    author_id?: string | null
                    category_id?: number | null
                    title?: string
                    image_url?: string | null
                    video_url?: string | null
                    time_minutes?: number
                    description?: string | null
                    steps?: string[]
                    created_at?: string | null
                    updated_at?: string | null
                    rating?: number | null
                }
            }
            ingredients: {
                Row: {
                    id: number
                    name: string
                    calories_per_100g: number
                    protein_per_100g: number
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    name: string
                    calories_per_100g?: number
                    protein_per_100g?: number
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    name?: string
                    calories_per_100g?: number
                    protein_per_100g?: number
                    created_at?: string | null
                }
            }
            recipe_ingredients: {
                Row: {
                    id: number
                    recipe_id: string
                    ingredient_id: number
                    amount_in_grams: number
                    group_name: string | null
                }
                Insert: {
                    id?: number
                    recipe_id: string
                    ingredient_id: number
                    amount_in_grams?: number
                    group_name?: string | null
                }
                Update: {
                    id?: number
                    recipe_id?: string
                    ingredient_id?: number
                    amount_in_grams?: number
                    group_name?: string | null
                }
            }
            tags: {
                Row: {
                    id: number
                    name: string
                }
                Insert: {
                    id?: number
                    name: string
                }
                Update: {
                    id?: number
                    name?: string
                }
            }
            recipe_tags: {
                Row: {
                    recipe_id: string
                    tag_id: number
                }
                Insert: {
                    recipe_id: string
                    tag_id: number
                }
                Update: {
                    recipe_id?: string
                    tag_id?: number
                }
            }
            meal_planner: {
                Row: {
                    id: number
                    user_id: string
                    recipe_id: string
                    date: string
                }
                Insert: {
                    id?: number
                    user_id: string
                    recipe_id: string
                    date: string
                }
                Update: {
                    id?: number
                    user_id?: string
                    recipe_id?: string
                    date?: string
                }
            }
            reviews: {
                Row: {
                    id: number
                    user_id: string
                    recipe_id: string
                    rating: number | null
                    comment: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number
                    user_id: string
                    recipe_id: string
                    rating?: number | null
                    comment?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: number
                    user_id?: string
                    recipe_id?: string
                    rating?: number | null
                    comment?: string | null
                    created_at?: string | null
                }
            }
        }
    }
}
