import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ShoppingCartProvider } from './contexts/ShoppingCartContext';
import { MealPlannerProvider } from './contexts/MealPlannerContext';
import { Toaster } from 'react-hot-toast';

// Lazy load pages for code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Search = React.lazy(() => import('./pages/Search'));
const RecipeDetail = React.lazy(() => import('./pages/RecipeDetail'));
const Planner = React.lazy(() => import('./pages/Planner'));
const CreateRecipe = React.lazy(() => import('./pages/CreateRecipe'));
const Auth = React.lazy(() => import('./pages/Auth'));
const ShoppingCart = React.lazy(() => import('./pages/ShoppingCart'));
const CategoryDetail = React.lazy(() => import('./pages/CategoryDetail'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const Statistics = React.lazy(() => import('./pages/Statistics'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Activity = React.lazy(() => import('./pages/Activity'));
const Categories = React.lazy(() => import('./pages/Categories'));

// A simple loading placeholder for Suspense
const PageLoader = () => (
    <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
    </div>
);

function App() {
    return (
        <ShoppingCartProvider>
            <MealPlannerProvider>
                <Toaster position="top-center" />
                <BrowserRouter>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route element={<Layout />}>
                                <Route index element={<Home />} />
                                <Route path="search" element={<Search />} />
                                <Route path="recipe/:id" element={<RecipeDetail />} />
                                <Route path="planner" element={<Planner />} />
                                <Route path="create" element={<CreateRecipe />} />
                                <Route path="edit/:id" element={<CreateRecipe />} />
                                <Route path="auth" element={<Auth />} />
                                <Route path="admin" element={<AdminDashboard />} />
                                <Route path="statistics" element={<Statistics />} />
                                <Route path="cart" element={<ShoppingCart />} />
                                <Route path="categories" element={<Categories />} />
                                <Route path="category/*" element={<CategoryDetail />} />
                                <Route path="profile" element={<Profile />} />
                                <Route path="activity" element={<Activity />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </MealPlannerProvider>
        </ShoppingCartProvider>
    );
}

export default App;
