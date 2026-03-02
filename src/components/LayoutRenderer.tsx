import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlbumLayoutConfig, LayoutSlot } from '@/lib/types';
import { getOptimizedImageUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface LayoutRendererProps {
    config: AlbumLayoutConfig;
    images: string[];
    className?: string;
}

export default function LayoutRenderer({ config, images, className }: LayoutRendererProps) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        handleResize(); // Initialize
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Base fallback configurations
    const mobileFallbackSlots: LayoutSlot[] = images.map((_, index) => ({
        id: `mobile-slot-${index}`,
        x: 0,
        y: index * (100 / images.length),
        width: 100,
        height: 100 / images.length,
        borderRadius: '12px'
    }));

    const layoutSlots = isMobile ? mobileFallbackSlots : config.slots;

    return (
        <div className={cn("relative w-full overflow-hidden bg-gray-50 rounded-2xl shadow-inner", className)} style={{ minHeight: isMobile ? `${images.length * 250}px` : '400px' }}>
            <AnimatePresence>
                {layoutSlots.map((slot, index) => {
                    if (!images[index]) return null;
                    return (
                        <motion.div
                            key={slot.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30
                            }}
                            className="absolute overflow-hidden shadow-md"
                            style={{
                                left: `${slot.x}%`,
                                top: `${slot.y}%`,
                                width: `calc(${slot.width}% - ${config.gap || 8}px)`,
                                height: `calc(${slot.height}% - ${config.gap || 8}px)`,
                                borderRadius: slot.borderRadius || '8px',
                                margin: `${(config.gap || 8) / 2}px`
                            }}
                        >
                            <img
                                src={getOptimizedImageUrl(images[index], 800, 80)}
                                alt={`Layout ${index}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
