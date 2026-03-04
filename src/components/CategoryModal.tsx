import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, X, Loader2, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Category } from '@/lib/types';

interface CategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    category?: Category | null;
    allCategories: Category[];
}

export default function CategoryModal({ isOpen, onClose, onSave, category, allCategories }: CategoryModalProps) {
    const [formData, setFormData] = useState({ name: '', image_url: '', parent_id: null as number | null });
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name,
                image_url: category.image_url || '',
                parent_id: category.parent_id || null
            });
        } else {
            setFormData({ name: '', image_url: '', parent_id: null });
        }
    }, [category, isOpen]);

    const processImageUrl = async (url: string): Promise<string> => {
        if (!url || url.includes('.supabase.co/storage')) return url;

        try {
            setUploading(true);
            const response = await fetch(url);
            const blob = await response.blob();
            const fileExt = blob.type.split('/')[1] || 'jpg';
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `categories/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('recipes').upload(filePath, blob);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('recipes').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (err) {
            console.error('Failed to ingest image URL:', err);
            return url;
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;

        try {
            setLoading(true);
            const finalImageUrl = await processImageUrl(formData.image_url);

            const payload = {
                name: formData.name,
                slug: formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                image_url: finalImageUrl || null,
                parent_id: formData.parent_id
            };

            if (category?.id) {
                const { error } = await supabase.from('categories').update(payload).eq('id', category.id);
                if (error) throw error;
            } else {
                // Find next order_index
                const siblings = allCategories.filter(c => c.parent_id === formData.parent_id);
                const nextOrder = siblings.length > 0
                    ? Math.max(...siblings.map(s => s.order_index || 0)) + 1
                    : 0;

                const { error } = await supabase.from('categories').insert([{ ...payload, order_index: nextOrder }]);
                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (error) {
            alert('Operation failed: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const deleteCategory = async () => {
        if (!category?.id || !confirm('Are you sure you want to delete this category?')) return;
        try {
            setLoading(true);
            const { error } = await supabase.from('categories').delete().eq('id', category.id);
            if (error) throw error;
            onSave();
            onClose();
        } catch (error) {
            alert('Delete failed: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-100"
                    >
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
                                    <ImageIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 leading-none">
                                        {category ? 'Edit Category' : 'New Category'}
                                    </h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter mt-1">Refine your collections</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 block px-1">Display Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Italian Mediterranean"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:bg-white focus:border-primary-500 outline-none font-bold text-gray-900 transition-all placeholder:text-gray-300"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 block px-1">Parent Category (Optional)</label>
                                <select
                                    value={formData.parent_id || ''}
                                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:bg-white focus:border-primary-500 outline-none font-bold text-gray-900 transition-all"
                                >
                                    <option value="">None (Top Level Category)</option>
                                    {allCategories.filter(c => c.id !== category?.id && !c.parent_id).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 block px-1">Cover Image</label>

                                <div className="w-full aspect-video rounded-[1.5rem] bg-gray-100 overflow-hidden relative border-2 border-dashed border-gray-200 group/preview">
                                    {formData.image_url ? (
                                        <>
                                            <img src={formData.image_url} className="w-full h-full object-cover" alt="" />
                                            <button
                                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                                className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors opacity-0 group-hover/preview:opacity-100"
                                            >
                                                <X size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                            {uploading ? <Loader2 className="w-8 h-8 animate-spin text-primary-500" /> : <ImageIcon className="text-gray-300" size={40} />}
                                            <p className="text-xs font-black uppercase text-gray-400 tracking-widest">No Image Selected</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <ExternalLink className="h-4 w-4 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Paste URL..."
                                            value={formData.image_url}
                                            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-primary-500 outline-none font-bold text-xs"
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={async (e) => {
                                                try {
                                                    setUploading(true);
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const fileExt = file.name.split('.').pop();
                                                    const fileName = `${Math.random()}.${fileExt}`;
                                                    const filePath = `categories/${fileName}`;
                                                    const { error: uploadError } = await supabase.storage.from('recipes').upload(filePath, file);
                                                    if (uploadError) throw uploadError;
                                                    const { data } = supabase.storage.from('recipes').getPublicUrl(filePath);
                                                    setFormData({ ...formData, image_url: data.publicUrl });
                                                } catch (err) {
                                                    alert('Upload failed: ' + (err as Error).message);
                                                } finally {
                                                    setUploading(false);
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={uploading}
                                        />
                                        <button className="h-full px-6 py-3.5 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-all font-black text-[10px] uppercase tracking-tighter flex items-center gap-2">
                                            {uploading ? <Loader2 className="animate-spin h-3 w-3" /> : <Upload className="h-3 w-3" />}
                                            Upload
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-gray-50/50 flex gap-4 mt-auto">
                            {category && (
                                <button
                                    onClick={deleteCategory}
                                    className="p-4 bg-white border border-red-100 text-red-500 rounded-[1.5rem] hover:bg-red-50 transition-all group/del"
                                    title="Delete Category"
                                    disabled={loading}
                                >
                                    <Trash2 size={24} className="group-hover/del:scale-110 transition-transform" />
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={loading || uploading || !formData.name.trim()}
                                className="flex-1 py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:hover:bg-gray-900 flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : null}
                                {category ? 'Update Category' : 'Create Category'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
