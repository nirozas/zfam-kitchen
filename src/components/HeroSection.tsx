import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface HeroSectionProps {
    heroImage: string;
}

export const HeroSection = ({ heroImage }: HeroSectionProps) => {
    return (
        <section className="relative min-h-[40vh] md:min-h-[60vh] flex items-center overflow-hidden py-12 md:py-20">
            {/* Background Image */}
            <div className="absolute inset-0">

                <img
                    src={heroImage}
                    alt="Delicious food"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50 via-gray-50/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent" />
            </div>

            {/* Content */}
            <div className="w-full max-w-[1800px] mx-auto px-6 md:px-12 relative z-10">
                <div className="max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100 text-primary-600 mb-2"
                    >
                        <Sparkles className="w-3 h-3" />
                        <span className="text-[10px] sm:text-xs font-medium">
                            Discover new flavors every day
                        </span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="font-display text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 leading-tight tracking-tight sm:tracking-tighter"
                    >
                        Cook with{" "}
                        <span className="text-primary-600">passion</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="mt-2 text-sm md:text-lg text-gray-600 max-w-lg font-medium leading-relaxed"
                    >
                        Explore hundreds of handcrafted recipes and plan your meals.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-4 flex flex-wrap gap-3"
                    >
                        <Button size="lg" className="group" asChild>
                            <Link to="/search">
                                Explore Recipes
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild className="hidden sm:inline-flex">
                            <Link to="/create">
                                <Plus className="mr-2 w-4 h-4" />
                                Add a Recipe
                            </Link>
                        </Button>
                        <Button variant="outline" size="lg" asChild>
                            <Link to="/planner">Plan Your Meals</Link>
                        </Button>
                    </motion.div>
                </div>
            </div>

            {/* Floating Elements */}
            <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-20 right-10 md:right-40 hidden lg:block"
            >
                <div className="w-24 h-24 rounded-full bg-primary-100/50 backdrop-blur-sm" />
            </motion.div>
            <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-40 right-20 hidden lg:block"
            >
                <div className="w-16 h-16 rounded-full bg-orange-100/50 backdrop-blur-sm" />
            </motion.div>
        </section>
    );
};
