import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface CookingModeProps {
    steps: Array<{ text: string; image_url?: string; alignment?: 'left' | 'center' | 'right' | 'full' }>;
    recipeTitle: string;
    onClose: () => void;
}

export default function CookingMode({ steps, recipeTitle, onClose }: CookingModeProps) {
    const [currentStep, setCurrentStep] = useState(0);

    // Prevent scrolling behind modal
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleNext = () => {
        if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black text-white flex flex-col"
        >
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="font-display font-bold text-xl text-gray-200">
                    <span className="text-primary-500 mr-2">Cooking:</span>
                    {recipeTitle}
                </h2>
                <button
                    onClick={onClose}
                    className="p-3 bg-gray-900 hover:bg-gray-800 rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative px-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="max-w-4xl w-full text-center"
                    >
                        <span className="text-primary-500 font-bold text-xl uppercase tracking-widest mb-4 block">
                            Step {currentStep + 1} of {steps.length}
                        </span>

                        <p className="font-sans text-3xl md:text-5xl leading-tight font-medium text-gray-100">
                            {steps[currentStep].text}
                        </p>

                        {steps[currentStep].image_url && (
                            <div className="mt-12 mx-auto max-w-lg aspect-video rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                                <img
                                    src={steps[currentStep].image_url}
                                    className="w-full h-full object-cover opacity-80 mix-blend-screen"
                                    alt="Step illustration"
                                />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Drawer */}
            <div className="p-8 pb-12 grid grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="flex items-center justify-center py-6 bg-gray-900 border-2 border-gray-800 hover:bg-gray-800 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-3xl"
                >
                    <ChevronLeft size={32} className="mr-2" />
                    <span className="font-bold text-xl">Previous</span>
                </button>

                <button
                    onClick={handleNext}
                    disabled={currentStep === steps.length - 1}
                    className="flex items-center justify-center py-6 bg-primary-600 hover:bg-primary-500 disabled:opacity-30 disabled:pointer-events-none transition-all rounded-3xl"
                >
                    <span className="font-bold text-xl">Next</span>
                    <ChevronRight size={32} className="ml-2" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-gray-900 w-full absolute bottom-0 left-0">
                <motion.div
                    className="h-full bg-primary-500"
                    animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    transition={{ type: "tween", duration: 0.3 }}
                />
            </div>
        </motion.div>
    );
}
