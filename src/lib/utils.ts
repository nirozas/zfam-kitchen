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
 * Fixes common external image URLs that don't point directly to the image file.
 * Currently handles: Dropbox
 */
export function fixImageUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    let fixedUrl = url.trim();

    // 1. Dropbox
    if (fixedUrl.includes('dropbox.com')) {
        if (fixedUrl.includes('dl=0')) {
            fixedUrl = fixedUrl.replace('dl=0', 'raw=1');
        } else if (!fixedUrl.includes('raw=1') && !fixedUrl.includes('dl=1')) {
            fixedUrl += (fixedUrl.includes('?') ? '&' : '?') + 'raw=1';
        }
    }

    return fixedUrl;
}

/**
 * Wraps a Supabase storage URL with transformation parameters to optimize imagery.
 */
export function getOptimizedImageUrl(url: string | null | undefined, width: number = 800, quality: number = 80): string | undefined {
    const fixedUrl = fixImageUrl(url);
    if (!fixedUrl) return undefined;

    // Check if it's a Supabase storage URL without existing transform query params
    if (fixedUrl.includes('/storage/v1/object/public/') && !fixedUrl.includes('?')) {
        return `${fixedUrl}?width=${width}&quality=${quality}&resize=contain`;
    }

    return fixedUrl;
}
