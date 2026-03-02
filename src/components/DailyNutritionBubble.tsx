import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { calculateDailyNutrition, NutritionData } from '@/lib/nutritionUtils';

interface DailyNutritionBubbleProps {
    date: string;
    userId: string | undefined;
}

export default function DailyNutritionBubble({ date, userId }: DailyNutritionBubbleProps) {
    const [nutrition, setNutrition] = useState<NutritionData>({ calories: 0, protein: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId || !date) return;

        let isMounted = true;
        setLoading(true);

        calculateDailyNutrition(userId, date)
            .then(data => {
                if (isMounted) {
                    setNutrition(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("Failed to load nutrition", err);
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [date, userId]);

    if (loading) return null; // Or a skeleton bubble
    if (nutrition.calories === 0) return null; // Hide if no food planner data

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute -top-12 right-2 bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_15px_-4px_rgba(233,84,84,0.4)] border border-primary-100 flex items-center px-4 py-1.5 gap-3 pointer-events-none z-10"
        >
            <div className="flex items-center gap-1.5 font-sans">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="font-bold text-gray-800 text-sm">{nutrition.calories.toLocaleString()}</span>
                <span className="text-xs text-gray-500 font-medium">kcal</span>
            </div>

            <div className="w-px h-3 bg-gray-200" />

            <div className="flex items-center gap-1.5 font-sans">
                <Activity size={12} className="text-primary-500" />
                <span className="font-bold text-gray-800 text-sm">{nutrition.protein.toLocaleString()}</span>
                <span className="text-xs text-gray-500 font-medium">g pro</span>
            </div>
        </motion.div>
    );
}
