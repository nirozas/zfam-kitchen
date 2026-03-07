import { useState, useMemo, useEffect } from 'react';
import { useCategories } from '@/lib/hooks';
import CategoryCard from '@/components/CategoryCard';
import CategoryModal from '@/components/CategoryModal';
import { Search, Loader2, Plus, Pencil, Trash2, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Categories() {
    const { categories, loading, error, refreshCategories } = useCategories();
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                setIsAdmin(profile?.role === 'admin');
            }
        };
        checkAdmin();
    }, []);

    const handleMove = async (category: any, direction: 'up' | 'down') => {
        const siblings = categories
            .filter(c => c.parent_id === category.parent_id)
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

        const currentIndex = siblings.findIndex(s => s.id === category.id);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        const targetCategory = siblings[targetIndex];

        // Swap order_index
        const newCurrentOrder = targetCategory.order_index || 0;
        const newTargetOrder = category.order_index || 0;

        try {
            const { error: err1 } = await supabase.from('categories').update({ order_index: newCurrentOrder }).eq('id', category.id);
            const { error: err2 } = await supabase.from('categories').update({ order_index: newTargetOrder }).eq('id', targetCategory.id);

            if (err1 || err2) throw err1 || err2;
            refreshCategories();
        } catch (err) {
            alert('Move failed');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this category?')) return;
        try {
            const { error } = await supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
            refreshCategories();
        } catch (err) {
            alert('Delete failed');
        }
    };

    const sortedCategories = useMemo(() => {
        const filtered = categories
            .filter(cat => cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

        const parents = filtered.filter(c => !c.parent_id);
        const children = filtered.filter(c => c.parent_id);

        const result: typeof categories = [];
        parents.forEach(parent => {
            result.push(parent);
            const parentChildren = children.filter(child => child.parent_id === parent.id);
            result.push(...parentChildren);
        });

        // Add orphans if any (children whose parents didn't match the search)
        const orphans = children.filter(child => !result.find(r => r.id === child.id));
        result.push(...orphans);

        return result;
    }, [categories, searchQuery]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading categories...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center text-red-500">
                    <p>Error loading categories: {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 py-16 px-4">
            <div className="container mx-auto max-w-[1800px]">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16 px-4">
                    <div className="text-left">
                        <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-2 tracking-tight">
                            Explore Categories
                        </h1>
                        <p className="text-gray-500 text-lg max-w-xl">
                            Discover new recipes and flavors by browsing our curated collections.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 lg:max-w-xl w-full">
                        <div className="relative group flex-1 w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search categories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-6 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-400 transition-all font-medium text-base"
                            />
                        </div>
                        {isAdmin && (
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                                <button
                                    onClick={() => {
                                        setSelectedCategory(null);
                                        setShowModal(true);
                                    }}
                                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-4 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg hover:-translate-y-0.5 whitespace-nowrap"
                                >
                                    <Plus size={14} /> Add Category
                                </button>
                                <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg hover:-translate-y-0.5 whitespace-nowrap ${isEditMode ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-900 text-white hover:bg-primary-600'
                                        }`}
                                >
                                    {isEditMode ? 'Done Editing' : 'Edit Categories'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {sortedCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-x-12 gap-y-16 items-start">
                        {categories.filter(c => !c.parent_id).map((parent) => {
                            const children = categories.filter(c => c.parent_id === parent.id);
                            const matchesSearch = parent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                children.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

                            if (!matchesSearch && searchQuery) return null;

                            return (
                                <div key={parent.id} className="flex gap-6 items-start shrink-0 bg-white/30 p-2 rounded-[2.5rem] border border-transparent hover:border-gray-100 transition-all relative group/parent">
                                    {/* Parent Card */}
                                    <div className="w-80 shrink-0 relative">
                                        <CategoryCard category={parent} index={0} />
                                        {isEditMode && (
                                            <div className="absolute top-4 right-4 flex gap-2 z-20">
                                                <div className="flex flex-col gap-1 mr-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMove(parent, 'up'); }}
                                                        className="p-2 bg-white/95 backdrop-blur-sm rounded-xl text-gray-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                        title="Move Up"
                                                    >
                                                        <ChevronLeft className="rotate-90" size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMove(parent, 'down'); }}
                                                        className="p-2 bg-white/95 backdrop-blur-sm rounded-xl text-gray-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                        title="Move Down"
                                                    >
                                                        <ChevronLeft className="-rotate-90" size={16} />
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedCategory(parent); setShowModal(true); }}
                                                    className="p-4 bg-white/95 backdrop-blur-sm rounded-2xl text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                    title="Edit Category"
                                                >
                                                    <Pencil size={20} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(parent.id); }}
                                                    className="p-4 bg-white/95 backdrop-blur-sm rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
                                                    title="Delete Category"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Children Grid - Stacking in 2 rows */}
                                    {children.length > 0 && (
                                        <div className="shrink-0 overflow-hidden">
                                            <div
                                                className="grid grid-flow-col gap-2"
                                                style={{
                                                    gridTemplateRows: 'repeat(2, min-content)',
                                                }}
                                            >
                                                {children.map((child, cIdx) => (
                                                    <div key={child.id} className="w-48 scale-[0.6] origin-top-left -mr-16 -mb-16 relative group/child">
                                                        <CategoryCard category={child} index={cIdx} isSubcategory={true} />
                                                        {isEditMode && (
                                                            <div className="absolute top-2 right-2 flex flex-col gap-1 z-20 scale-125">
                                                                <div className="flex gap-1 mb-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMove(child, 'up'); }}
                                                                        className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg text-gray-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                                        title="Move Left"
                                                                    >
                                                                        <ChevronLeft size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleMove(child, 'down'); }}
                                                                        className="p-1.5 bg-white/95 backdrop-blur-sm rounded-lg text-gray-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                                        title="Move Right"
                                                                    >
                                                                        <ChevronLeft className="rotate-180" size={12} />
                                                                    </button>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedCategory(child); setShowModal(true); }}
                                                                    className="p-3 bg-white/95 backdrop-blur-sm rounded-xl text-primary-600 hover:bg-primary-600 hover:text-white transition-all shadow-xl active:scale-95"
                                                                    title="Edit Sub-Category"
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(child.id); }}
                                                                    className="p-3 bg-white/95 backdrop-blur-sm rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
                                                                    title="Delete Sub-Category"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-20 text-center">
                        <p className="text-gray-500 text-xl">No categories found matching "{searchQuery}"</p>
                    </div>
                )}

                <CategoryModal
                    isOpen={showModal}
                    onClose={() => { setShowModal(false); setSelectedCategory(null); }}
                    onSave={refreshCategories}
                    category={selectedCategory}
                    allCategories={categories}
                />
            </div>
        </div>
    );
}
