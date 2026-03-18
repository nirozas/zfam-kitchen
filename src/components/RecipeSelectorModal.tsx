import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useRecipes } from '@/lib/hooks';
import { getOptimizedImageUrl } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface RecipeSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (recipe: { id: string; title: string; image_url: string | null; slug: string | null }) => void;
}

export default function RecipeSelectorModal({ isOpen, onClose, onSelect }: RecipeSelectorModalProps) {
    const { recipes, loading, error } = useRecipes({ minimal: true });
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRecipes = useMemo(() => {
        if (!searchQuery) return recipes;
        return recipes.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [recipes, searchQuery]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl border border-gray-100 flex flex-col max-h-[80vh]"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tighter">Link a Recipe</h3>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Select a related recipe to attach</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search your recipes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-semibold focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-50 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="text-center py-10 text-gray-400 font-bold text-sm flex flex-col items-center gap-2">
                           <div className="w-8 h-8 border-4 border-gray-100 border-t-indigo-500 rounded-full animate-spin"></div>
                           <span>Loading recipes...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 px-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 text-red-500 font-bold">⚠️</div>
                            <p className="text-sm font-bold text-gray-800 mb-1">Could not fetch recipes</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">{error}</p>
                        </div>
                    ) : filteredRecipes.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 font-bold text-sm">No recipes found.</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredRecipes.map(recipe => (
                                <button
                                    key={recipe.id}
                                    onClick={() => onSelect({ id: String(recipe.id), title: recipe.title, image_url: recipe.image_url || null, slug: recipe.slug || null })}
                                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors text-left border border-transparent hover:border-gray-100 group"
                                >
                                    <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                                        {recipe.image_url ? (
                                            <img src={getOptimizedImageUrl(recipe.image_url)} alt={recipe.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">🍽️</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">{recipe.title}</h4>
                                        {recipe.category?.name && (
                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mt-1 truncate">{recipe.category.name}</p>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
}
