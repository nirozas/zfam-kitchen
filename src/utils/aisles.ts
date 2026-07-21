/**
 * Simple dictionary to group ingredients into typical supermarket aisles.
 */

const aisleDictionary: Record<string, string[]> = {
    'Produce 🥬': [
        'apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'strawberry', 'blueberry', 'raspberry',
        'onion', 'garlic', 'potato', 'carrot', 'tomato', 'lettuce', 'spinach', 'kale', 'celery', 'cucumber',
        'pepper', 'zucchini', 'squash', 'broccoli', 'cauliflower', 'asparagus', 'avocado', 'mushroom',
        'herb', 'cilantro', 'parsley', 'basil', 'mint', 'thyme', 'rosemary', 'ginger', 'fruit', 'vegetable',
        'greens', 'cabbage', 'corn', 'pea'
    ],
    'Dairy & Eggs 🥛': [
        'milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'parmesan', 'cheddar', 'mozzarella', 
        'feta', 'ricotta', 'brie', 'ghee', 'whey'
    ],
    'Meat & Seafood 🥩': [
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'ground',
        'salmon', 'tuna', 'shrimp', 'fish', 'crab', 'lobster', 'cod', 'tilapia', 'halibut', 'scallop'
    ],
    'Pantry 🥫': [
        'flour', 'sugar', 'salt', 'pepper', 'oil', 'olive', 'vinegar', 'soy sauce', 'rice', 'pasta',
        'noodle', 'bean', 'lentil', 'canned', 'broth', 'stock', 'tomato paste', 'sauce', 'honey', 
        'maple', 'syrup', 'peanut', 'almond', 'nut', 'seed', 'spice', 'cinnamon', 'cumin', 'paprika',
        'baking', 'yeast', 'chocolate', 'cocoa', 'vanilla', 'oat', 'cereal', 'bread', 'tortilla'
    ],
    'Frozen 🧊': [
        'frozen', 'ice', 'pizza', 'waffle'
    ],
    'Beverages 🧃': [
        'water', 'juice', 'coffee', 'tea', 'soda', 'beer', 'wine', 'liquor'
    ]
};

export function getAisleForIngredient(ingredientName: string): string {
    const lowerName = ingredientName.toLowerCase();
    
    for (const [aisle, keywords] of Object.entries(aisleDictionary)) {
        if (keywords.some(keyword => lowerName.includes(keyword))) {
            return aisle;
        }
    }
    
    return 'Other 🛒';
}
