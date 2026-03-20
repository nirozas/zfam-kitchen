import React, { useState, useEffect } from 'react';
import { Bug, Clock, Trash2, Loader2, AlertCircle, Plus, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface BugReport {
    id: string;
    user_id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'fixed';
    admin_notes?: string | null;
    created_at: string;
    updated_at: string;
    profiles?: {
        username: string;
    } | null;
}

const AdminBugReports: React.FC = () => {
    const [reports, setReports] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('bug_reports')
                .select('*, profiles(username)')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setReports(data || []);
        } catch (err: any) {
            console.error('Error fetching bug reports:', err);
            setError(err.message || 'Failed to fetch bug reports. Please make sure the table exists.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const updateStatus = async (id: string, status: BugReport['status']) => {
        setUpdatingId(id);
        try {
            const { error: updateErr } = await supabase
                .from('bug_reports')
                .update({
                    status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (updateErr) throw updateErr;
            setReports(reports.map(r => r.id === id ? { ...r, status, updated_at: new Date().toISOString() } : r));
        } catch (err) {
            console.error('Error updating status:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const updateNotes = async (id: string, notes: string) => {
        setUpdatingId(id);
        try {
            const { error: noteErr } = await supabase
                .from('bug_reports')
                .update({
                    admin_notes: notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (noteErr) throw noteErr;
            setReports(reports.map(r => r.id === id ? { ...r, admin_notes: notes, updated_at: new Date().toISOString() } : r));
        } catch (err) {
            console.error('Error updating notes:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const deleteReport = async (id: string) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            const { error: deleteErr } = await supabase
                .from('bug_reports')
                .delete()
                .eq('id', id);

            if (deleteErr) throw deleteErr;
            setReports(reports.filter(r => r.id !== id));
        } catch (err) {
            console.error('Error deleting report:', err);
        }
    };

    if (loading) return (
        <div className="p-12 text-center">
            <Loader2 className="animate-spin mx-auto text-primary-500 mb-2" size={32} />
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Loading Reports...</p>
        </div>
    );

    if (error) return (
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-3xl flex flex-col items-center text-center gap-4">
            <AlertCircle className="text-rose-500" size={32} />
            <div>
                <p className="text-gray-900 font-black text-xl tracking-tight">Failed to load reports</p>
                <p className="text-gray-500 text-sm mt-1">{error}</p>
            </div>
            <button onClick={fetchReports} className="px-6 py-2.5 bg-rose-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-rose-700 transition-all">Retry</button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Bug className="text-rose-500" size={24} />
                    Squash Fix Dashboard ({reports.length})
                </h3>
                <button onClick={fetchReports} className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <Clock className="text-gray-400" size={18} />
                </button>
            </div>

            {reports.length === 0 ? (
                <div className="p-20 bg-gray-50/50 rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
                    <Bug className="text-gray-200 mb-6" size={64} />
                    <h4 className="text-xl font-black text-gray-400 uppercase tracking-widest leading-none">No Bugs Reported</h4>
                    <p className="text-gray-400 font-medium text-sm mt-3">Your kitchen is currently bug-free!</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    <AnimatePresence>
                        {reports.map((report) => (
                            <motion.div
                                key={report.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white rounded-[2.5rem] border-2 p-8 shadow-sm transition-all flex flex-col gap-6 ${report.status === 'fixed' ? 'border-emerald-100 opacity-60' : 'border-gray-50 hover:border-primary-100 shadow-gray-100/50 hover:shadow-xl'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <div className="relative">
                                                <select
                                                    value={report.status}
                                                    onChange={(e) => updateStatus(report.id, e.target.value as any)}
                                                    className={`appearance-none font-black text-[10px] uppercase tracking-widest px-6 py-2 rounded-xl cursor-pointer border-none outline-none pr-10 ${report.status === 'fixed' ? 'bg-emerald-50 text-emerald-600' :
                                                            report.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                                                                'bg-primary-50 text-primary-600'
                                                        }`}
                                                >
                                                    <option value="pending">PENDING</option>
                                                    <option value="in_progress">COOKING FIX</option>
                                                    <option value="fixed">SQUASHED & FIXED</option>
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 opacity-50">
                                                    {updatingId === report.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} className="rotate-45" />}
                                                </div>
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest">SUBMITTED BY</span>
                                                <span className="text-gray-600 font-bold tracking-tight">{report.profiles?.username || 'Unknown Chef'}</span>
                                            </div>

                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest">DATE</span>
                                                <span className="text-gray-500 text-xs font-medium">{new Date(report.created_at).toLocaleString()}</span>
                                            </div>

                                            <button
                                                onClick={() => deleteReport(report.id)}
                                                className="ml-auto p-3 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                                title="Delete Report"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 ring-4 ring-gray-50/50">
                                            <p className="text-gray-700 font-medium whitespace-pre-wrap leading-relaxed italic">"{report.description}"</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100">
                                    <div className="flex flex-col gap-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Send size={12} className="text-primary-400" />
                                            Admin Resolution Notes
                                        </label>
                                        <div className="flex gap-4">
                                            <textarea
                                                id={`notes-${report.id}`}
                                                defaultValue={report.admin_notes || ''}
                                                placeholder="Detail the fix or progress..."
                                                className="flex-1 px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium text-gray-700 focus:ring-4 focus:ring-primary-50 outline-none transition-all resize-none min-h-[40px]"
                                            />
                                            <button
                                                onClick={() => {
                                                    const val = (document.getElementById(`notes-${report.id}`) as HTMLTextAreaElement).value;
                                                    updateNotes(report.id, val);
                                                }}
                                                className="px-8 bg-gray-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-gray-200 flex items-center"
                                            >
                                                {updatingId === report.id ? <Loader2 size={14} className="animate-spin" /> : 'Save Fix Notes'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default AdminBugReports;
