import React, { useState, useRef } from 'react';
import { Camera, Upload, Loader2, Receipt, FileText, CheckCircle2, ChevronRight, Store, Calendar, DollarSign, ListOrdered, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ReceiptData {
    date: string;
    store: string;
    total: number;
    items: Array<{
        name: string;
        price: number;
    }>;
}

export default function ScanReceipt() {
    const navigate = useNavigate();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview the image
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setImageSrc(dataUrl);
            scanReceiptImage(dataUrl, file.type);
        };
        reader.readAsDataURL(file);
    };

    const scanReceiptImage = async (dataUrl: string, mimeType: string) => {
        setIsScanning(true);
        setReceiptData(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-receipt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || anonKey}`,
                    'apikey': anonKey
                },
                body: JSON.stringify({
                    image: dataUrl,
                    mimeType: mimeType
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to scan receipt');
            }

            const data = await response.json();
            setReceiptData(data);
            toast.success('Receipt scanned successfully!');
        } catch (error: any) {
            console.error('Scanning error:', error);
            toast.error(error.message || 'Failed to analyze receipt. Please try again.');
        } finally {
            setIsScanning(false);
        }
    };

    const resetScanner = () => {
        setImageSrc(null);
        setReceiptData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
            <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 tracking-tight">Receipt Scanner</h1>
                            <p className="text-xs font-bold text-primary-600 uppercase tracking-wider">AI Powered</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                <AnimatePresence mode="wait">
                    {!imageSrc ? (
                        <motion.div 
                            key="upload"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm text-center"
                        >
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Receipt className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2">Scan a Receipt</h2>
                            <p className="text-gray-500 font-medium mb-8 max-w-md mx-auto">
                                Upload or take a photo of your grocery receipt. Our AI will automatically extract the store name, date, total, and all purchased items.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full sm:w-auto px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    <Camera className="w-5 h-5" />
                                    Take Photo
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Upload className="w-5 h-5" />
                                    Upload File
                                </button>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="results"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6"
                        >
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-indigo-500" />
                                        Receipt Image
                                    </h3>
                                    <button 
                                        onClick={resetScanner}
                                        className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        Scan Another
                                    </button>
                                </div>
                                <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-video md:aspect-[21/9] flex items-center justify-center">
                                    <img src={imageSrc} alt="Receipt" className="object-contain w-full h-full max-h-[300px] mix-blend-multiply opacity-80" />
                                    {isScanning && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                                            <div className="relative">
                                                <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
                                                <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
                                                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                                                    <Loader2 className="w-6 h-6 animate-spin" />
                                                </div>
                                            </div>
                                            <p className="mt-4 font-black text-gray-900 tracking-tight">Analyzing Receipt...</p>
                                            <p className="text-sm font-bold text-indigo-600 tracking-wider uppercase mt-1">Extracting Data</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {receiptData && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Results</h3>
                                            <p className="text-sm font-semibold text-green-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-4 h-4" /> Successfully parsed
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Store className="w-3 h-3" /> Store</p>
                                            <p className="font-bold text-gray-900 truncate">{receiptData.store || 'Unknown'}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/50">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</p>
                                            <p className="font-bold text-gray-900">{receiptData.date || 'Unknown'}</p>
                                        </div>
                                        <div className="bg-primary-50 rounded-2xl p-4 border border-primary-100 col-span-2 md:col-span-1 flex flex-col justify-center">
                                            <p className="text-xs font-black text-primary-600/80 uppercase tracking-wider mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total</p>
                                            <p className="text-2xl font-black text-primary-700">${(receiptData.total || 0).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-black text-gray-900 flex items-center gap-2 mb-4">
                                            <ListOrdered className="w-4 h-4 text-gray-400" />
                                            Items ({receiptData.items?.length || 0})
                                        </h4>
                                        <div className="space-y-2">
                                            {receiptData.items?.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                                                    <span className="font-medium text-gray-700">{item.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-gray-900">${(item.price || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!receiptData.items || receiptData.items.length === 0) && (
                                                <p className="text-center py-6 text-sm font-semibold text-gray-400">No items detected.</p>
                                            )}
                                        </div>
                                    </div>
                                    
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
