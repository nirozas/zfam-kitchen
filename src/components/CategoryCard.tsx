import { Category } from '@/lib/types';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface CategoryCardProps {
    category: Category;
    index: number;
    isSubcategory?: boolean;
}

export default function CategoryCard({ category, index, isSubcategory }: CategoryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="group relative flex flex-col items-center"
        >
            <Link to={`/category/${category.slug}`} className="block w-full text-center">
                {/* Circular Image Container */}
                <div className="aspect-square w-full bg-gray-50 relative overflow-hidden rounded-full border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
                    {category.image_url ? (
                        <img
                            src={category.image_url}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            alt={category.name}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-200">
                            <span className="text-2xl opacity-50">{getCategoryEmoji(category.slug)}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Compact Title */}
                <div className="mt-2 px-1">
                    <h3 className={`font-black text-gray-900 leading-tight group-hover:text-primary-600 transition-colors line-clamp-2 h-7 flex items-center justify-center text-center ${isSubcategory ? 'text-[18px]' : 'text-[10px] sm:text-[11px]'
                        }`}>
                        {category.name}
                    </h3>
                </div>
            </Link>
        </motion.div>
    );
}

function getCategoryEmoji(slug: string) {
    switch (slug) {
        case 'breakfast': return '🍳';
        case 'lunch': return '🥗';
        case 'dinner': return '🍝';
        case 'dessert': return '🍰';
        default: return '🍽️';
    }
}
