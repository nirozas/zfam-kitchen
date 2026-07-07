export function toTitleCase(str: string): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function getStoreNameFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.toLowerCase();
        if (domain.includes('amazon.') || domain.includes('amzn.to')) return 'Amazon';
        if (domain.includes('walmart.')) return 'Walmart';
        if (domain.includes('costco.')) return 'Costco';
        if (domain.includes('target.')) return 'Target';
        if (domain.includes('instacart.')) return 'Instacart';
        if (domain.includes('wholefoodsmarket.')) return 'Whole Foods';
        if (domain.includes('traderjoes.')) return 'Trader Joe\'s';
        if (domain.includes('kroger.')) return 'Kroger';
        if (domain.includes('safeway.')) return 'Safeway';
        if (domain.includes('albertsons.')) return 'Albertsons';
        if (domain.includes('publix.')) return 'Publix';
        
        // Extract basic name if no known mapping
        const parts = domain.split('.');
        if (parts.length >= 2) {
            const name = parts[parts.length - 2];
            if (name !== 'com' && name !== 'org' && name !== 'net' && name !== 'co') {
                return toTitleCase(name);
            }
        }
    } catch (e) {
        // invalid URL
    }
    return null;
}
