import React from 'react';
import { AlbumLayoutConfig, LayoutSlot } from '@/lib/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ThumbnailGeneratorProps {
    config: AlbumLayoutConfig;
    className?: string; // e.g. w-32 h-32 to constrain the thumbnail container
    isActive?: boolean;
    onClick?: () => void;
}

export default function ThumbnailGenerator({ config, className, isActive, onClick }: ThumbnailGeneratorProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={cn(
                "relative bg-white cursor-pointer overflow-hidden transition-all duration-300 shadow-sm border-2 rounded-xl",
                isActive ? "border-primary-500 shadow-primary-200 shadow-lg" : "border-gray-200 hover:border-primary-300",
                className
            )}
        >
            <div className="absolute inset-2">
                {config.slots.map((slot) => (
                    <div
                        key={slot.id}
                        className={cn(
                            "absolute rounded bg-gray-100 transition-colors duration-300",
                            isActive ? "bg-primary-100/50" : "hover:bg-gray-200"
                        )}
                        style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `calc(${slot.width}% - ${config.gap || 4}px)`,
                            height: `calc(${slot.height}% - ${config.gap || 4}px)`,
                            borderRadius: '4px',
                            margin: `${(config.gap || 4) / 2}px`
                        }}
                    />
                ))}
            </div>
        </motion.div>
    );
}
