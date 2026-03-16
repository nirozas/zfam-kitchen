import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface LinkImporterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: (data: any) => void;
}

export default function LinkImporterModal({ isOpen, onClose, onImportSuccess }: LinkImporterModalProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importedData, setImportedData] = useState<any>(null);
    const [step, setStep] = useState<'input' | 'image_selection'>('input');

    const handleImport = async () => {
        if (!url.trim()) return;
        setLoading(true);
        setError(null);

        try {
            const { data, error: functionError } = await supabase.functions.invoke('import-recipe', {
                body: { url: url.trim() }
            });

            if (functionError) throw functionError;
            if (!data) throw new Error('No data returned from importer');
            if (data.error) throw new Error(data.error);

            if (data.all_images && data.all_images.length > 1) {
                setImportedData(data);
                setStep('image_selection');
            } else {
                onImportSuccess(data);
                onClose();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to import recipe.');
            toast.error('Import failed');
        } finally {
            setLoading(false);
        }
    };

    const confirmWithImage = (imageUrl: string) => {
        onImportSuccess({ ...importedData, image_url: imageUrl });
        onClose();
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
                        {/* Header */}
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-primary-50/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 shadow-inner">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 leading-none">Magic Import</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter mt-1">From URL to Recipe in seconds</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-6">
                            {step === 'input' ? (
                                <div className="space-y-4">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                            <LinkIcon className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="url"
                                            placeholder="Paste recipe link (TikTok, Instagram, Blog...)"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            className="w-full pl-14 pr-6 py-5 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:bg-white focus:border-primary-500 outline-none font-bold text-gray-900 transition-all placeholder:text-gray-300 shadow-inner"
                                            autoFocus
                                        />
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="flex items-start gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-sm font-medium"
                                        >
                                            <AlertCircle className="h-5 w-5 shrink-0" />
                                            <span>{error}</span>
                                        </motion.div>
                                    )}

                                    <div className="bg-gray-50 rounded-[1.5rem] p-6 border border-gray-100">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 px-1">How it works</h4>
                                        <ul className="space-y-3">
                                            <li className="flex items-center gap-3 text-xs font-bold text-gray-600">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                                                Supports websites and Blogs
                                            </li>
                                            <li className="flex items-center gap-3 text-xs font-bold text-gray-600">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                                                Automatically extracts steps and ingredients
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-black text-gray-900 px-1">Choose the best image</h4>
                                    <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {importedData?.all_images?.map((img: string, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => confirmWithImage(img)}
                                                className="aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary-500 transition-all relative group"
                                            >
                                                <img src={img} className="w-full h-full object-cover" alt="" />
                                                <div className="absolute inset-0 bg-primary-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="bg-white text-primary-600 text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg">Select</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => confirmWithImage(importedData?.image_url)}
                                        className="w-full py-3 text-xs font-bold text-gray-500 hover:text-gray-900 border-2 border-dashed border-gray-100 rounded-2xl hover:bg-gray-50 transition-all"
                                    >
                                        Skip / Use Default
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-8 bg-gray-50/50 flex flex-col gap-4">
                            <button
                                onClick={handleImport}
                                disabled={loading || !url.trim()}
                                className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:hover:bg-gray-900 flex items-center justify-center gap-3 relative overflow-hidden group"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        <span>Analyzing Recipe...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} className="group-hover:scale-125 transition-transform" />
                                        <span>Magic Import</span>
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-tighter">
                                By importing you agree to credit the original author
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
