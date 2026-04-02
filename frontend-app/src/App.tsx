import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Recipes } from './pages/Recipes';
import { ShoppingList } from './pages/ShoppingList';
import { Plan } from './pages/Plan';
import { AddFood } from './pages/AddFood';
import AddRecipe from './pages/AddRecipe';
import { RecipeDetails } from './pages/RecipeDetails';
import { Onboarding } from './pages/Onboarding';
import { Profile } from './pages/Profile';
import { ProductDetails } from './pages/ProductDetails';
import { AppDataProvider } from './lib/AppDataContext';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center font-headline text-on-surface">Ładowanie aplikacji...</div>;
  }

  return (
    <Router>
      <AppDataProvider>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <Plan /> : <Navigate to="/login" />} />
          <Route path="/add-food" element={session ? <AddFood /> : <Navigate to="/login" />} />
          <Route path="/add-recipe" element={session ? <AddRecipe /> : <Navigate to="/login" />} />
          <Route path="/edit-recipe/:id" element={session ? <AddRecipe /> : <Navigate to="/login" />} />
          <Route path="/recipe/:id" element={session ? <RecipeDetails /> : <Navigate to="/login" />} />
          <Route path="/product/:id" element={session ? <ProductDetails /> : <Navigate to="/login" />} />
          <Route path="/recipes" element={session ? <Recipes /> : <Navigate to="/login" />} />
          <Route path="/cart" element={session ? <ShoppingList /> : <Navigate to="/login" />} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
        </Routes>
      </AppDataProvider>
    </Router>
  );
}

export default App;
