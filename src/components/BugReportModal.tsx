import React, { useState } from 'react';
import { Bug, Send, X, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: { session } } = await supabase.auth.getSession();
        if (!description.trim() || !session?.user) return;

        setLoading(true);
        setError(null);

        try {
            const { error: submitError } = await supabase
                .from('bug_reports')
                .insert({
                    user_id: session.user.id,
                    description: description.trim(),
                    status: 'pending'
                });

            if (submitError) throw submitError;

            setSubmitted(true);
            setDescription('');
            setTimeout(() => {
                setSubmitted(false);
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error('Error reporting bug:', err);
            setError(err.message || 'Failed to submit bug report. You may need to create the table first.');
            toast.error('Failed to report bug');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-hidden">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden flex flex-col z-10"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-br from-rose-500 to-rose-600 px-8 py-8 text-white relative">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex items-center gap-4 mb-3">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Bug size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight">Report a Bug</h2>
                                    <p className="text-rose-100 text-xs font-bold uppercase tracking-widest mt-0.5 opacity-80">Help us squash it</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            {submitted ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-inner">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Report Received!</h3>
                                    <p className="text-gray-500 font-medium mt-2">Our kitchen team has been notified. Thank you!</p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Detail the problem</label>
                                        <textarea
                                            autoFocus
                                            required
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What happened? Steps to reproduce help a lot..."
                                            className="w-full h-40 px-6 py-4 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-4 focus:ring-rose-100 focus:bg-white focus:border-rose-300 outline-none transition-all resize-none font-medium text-gray-700"
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold leading-tight flex items-center gap-3">
                                            <Bug size={18} className="flex-shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !description.trim()}
                                        className="w-full py-5 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-gray-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                                    >
                                        {loading ? (
                                            <Loader2 className="animate-spin" size={20} />
                                        ) : (
                                            <>
                                                <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                Submit Report
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default BugReportModal;
