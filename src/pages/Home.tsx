import RecipeCard from '@/components/RecipeCard';
import CategoryCard from '@/components/CategoryCard';
import { motion } from 'framer-motion';
import { ArrowRight, Heart, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HeroSection } from '@/components/HeroSection';
import { useRecipes, useCategories } from '@/lib/hooks';
import RecipeCardSkeleton from '@/components/RecipeCardSkeleton';
import CategoryCardSkeleton from '@/components/CategoryCardSkeleton';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

/* Button Styles Helper */
const buttonVariants = (variant: 'hero' | 'outline' | 'ghost' | 'secondary', size: 'lg' | 'default' = 'default') => {
    const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    const sizes = {
        default: "h-9 px-4 py-2",
        lg: "h-10 rounded-md px-8 text-base",
    };
    const variants = {
        hero: "bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-primary-200",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground border-gray-200 hover:bg-gray-50 text-gray-700",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:bg-gray-100 text-gray-600",
        secondary: "bg-white text-gray-900 shadow-sm hover:bg-gray-50",
    };
    return `${base} ${sizes[size]} ${variants[variant]}`;
};

const Index = () => {
    const { recipes, loading: recipesLoading, error: recipesError } = useRecipes({ limit: 40 });
    const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();

    useEffect(() => {
        if (recipesError) {
            toast.error(`Recipes: ${recipesError}`, { id: 'recipes-error' });
        }
    }, [recipesError]);

    useEffect(() => {
        if (categoriesError) {
            toast.error(`Categories: ${categoriesError}`, { id: 'categories-error' });
        }
    }, [categoriesError]);


    // Use all recipes for now, or filter if we had "featured" flag
    const featuredRecipes = recipes.slice(0, 10);
    const popularRecipes = recipes.slice(10, 40);

    return (
        <div className="min-h-screen bg-gray-50/50">

            <HeroSection heroImage="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop" />

            {/* Categories Section */}
            <section className="py-16 bg-white/50 backdrop-blur-sm border-y border-gray-100">
                <div className="w-full max-w-[1800px] mx-auto px-6 md:px-12">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 text-gray-900">
                                Browse Categories
                            </h2>
                            <p className="text-gray-500">
                                Find the perfect recipe for any occasion
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/categories" className={buttonVariants('hero')}>
                                <Plus className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Add Category</span>
                            </Link>
                            <Link to="/categories" className={buttonVariants('outline')}>
                                Explore All
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-24 gap-2 sm:gap-4">
                        {categoriesLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <CategoryCardSkeleton key={i} />
                            ))
                        ) : (
                            categories
                                .filter(category => !category.parent_id)
                                .map((category, index) => (
                                    <CategoryCard key={category.id} category={category} index={index} />
                                ))
                        )}
                    </div>
                </div>
            </section>

            {/* Featured Recipes */}
            <section className="py-16">
                <div className="w-full max-w-[1800px] mx-auto px-6 md:px-12">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 text-gray-900">
                                Featured Recipes
                            </h2>
                            <p className="text-gray-500">
                                Handpicked favorites from our kitchen
                            </p>
                        </div>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-100px" }}
                        variants={{
                            hidden: { opacity: 0 },
                            visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.1 }
                            }
                        }}
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-6"
                    >
                        {recipesLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <RecipeCardSkeleton key={i} />
                            ))
                        ) : (
                            featuredRecipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} />
                            ))
                        )}
                    </motion.div>
                </div>
            </section>

            {/* Popular Recipes */}
            <section className="py-16 bg-white/50 border-y border-gray-100">
                <div className="w-full max-w-[1800px] mx-auto px-6 md:px-12">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 text-gray-900">
                                Popular Recipes
                            </h2>
                            <p className="text-gray-500">
                                Most loved by our community
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/create" className={buttonVariants('hero')}>
                                <Plus className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">New Recipe</span>
                            </Link>
                            <Link to="/search" className={buttonVariants('outline')}>
                                <Search className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Search</span>
                            </Link>
                            <Link to="/search" className={buttonVariants('outline')}>
                                See All
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-6">
                        {recipesLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <RecipeCardSkeleton key={i} />
                            ))
                        ) : (
                            popularRecipes.map((recipe) => (
                                <RecipeCard key={recipe.id} recipe={recipe} />
                            ))
                        )}
                    </div>

                    <div className="mt-8 text-center md:hidden">
                        <Link to="/search" className={buttonVariants('outline')}>
                            See All Recipes
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="relative rounded-3xl overflow-hidden bg-primary-600 p-8 md:p-16 text-center shadow-2xl shadow-primary-200"
                    >
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute top-0 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
                            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
                        </div>

                        <div className="relative z-10 text-white">
                            <Heart className="h-12 w-12 mx-auto mb-6 text-white/90" />
                            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                                Start Your Culinary Journey
                            </h2>
                            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                                Favorite recipes, plan your meals, and cook delicious food every day.
                            </p>
                            <Link
                                to="/create"
                                className="inline-flex items-center justify-center bg-white text-primary-600 hover:bg-gray-50 px-8 py-3 rounded-md font-semibold text-lg transition-colors"
                            >
                                Get Started Free
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default Index;
