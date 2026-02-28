import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Wraps a Supabase storage URL with transformation parameters to optimize imagery.
 */
export function getOptimizedImageUrl(url: string | null | undefined, width: number = 800, quality: number = 80): string | undefined {
    if (!url) return undefined;

    // Check if it's a Supabase storage URL without existing transform query params
    if (url.includes('/storage/v1/object/public/') && !url.includes('?')) {
        return `${url}?width=${width}&quality=${quality}&resize=contain`;
    }

    return url;
}
