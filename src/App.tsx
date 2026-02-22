import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import RecipeDetail from './pages/RecipeDetail';
import Planner from './pages/Planner';
import CreateRecipe from './pages/CreateRecipe';
import Auth from './pages/Auth';
import ShoppingCart from './pages/ShoppingCart';
import CategoryDetail from './pages/CategoryDetail';
import AdminDashboard from './pages/AdminDashboard';
import Statistics from './pages/Statistics';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import Categories from './pages/Categories';
import { ShoppingCartProvider } from './contexts/ShoppingCartContext';
import { MealPlannerProvider } from './contexts/MealPlannerContext';

import { Toaster } from 'react-hot-toast';
import Search from './pages/Search';

function App() {
    return (
        <ShoppingCartProvider>
            <MealPlannerProvider>
                <Toaster position="top-center" />
                <BrowserRouter>
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
                </BrowserRouter>
            </MealPlannerProvider>
        </ShoppingCartProvider>
    );
}

export default App;
