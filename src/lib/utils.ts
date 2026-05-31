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

export function formatAmount(amount: number): string {
    if (!amount) return '';
    const fractionMap: Record<string, string> = {
        '0.25': '1/4', '0.5': '1/2', '0.75': '3/4', '0.33': '1/3', '0.67': '2/3',
        '0.125': '1/8', '0.375': '3/8', '0.625': '5/8', '0.875': '7/8'
    };
    const whole = Math.floor(amount);
    const decimal = amount - whole;
    if (decimal === 0) return whole.toString();
    
    // Find closest fraction
    let closestKey = '';
    let minDiff = 1;
    for (const key of Object.keys(fractionMap)) {
        const diff = Math.abs(decimal - parseFloat(key));
        if (diff <= 0.05) { // tolerance
            if (diff < minDiff) {
                minDiff = diff;
                closestKey = key;
            }
        }
    }
    
    if (closestKey) {
        return whole > 0 ? `${whole} ${fractionMap[closestKey]}` : fractionMap[closestKey];
    }
    
    return Number(amount.toFixed(2)).toString();
}
