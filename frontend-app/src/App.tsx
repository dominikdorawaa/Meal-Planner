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
import { api, clearSession, type AuthUser } from './lib/apiClient';
import { BackendLoader } from './components/BackendLoader';

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Przy starcie: sprawdź czy mamy zapisany token w localStorage
    const storedUser = api.auth.getUser();
    setUser(storedUser);
    setLoading(false);

    // Nasłuchuj zdarzenia 'auth-change' emitowanego przez Login.tsx
    const handleAuthChange = () => {
      const currentUser = api.auth.getUser();
      setUser(currentUser);
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-surface flex items-center justify-center font-headline text-on-surface">Ładowanie aplikacji...</div>;
  }

  const isLoggedIn = !!user;

  return (
    <Router>
      <AppDataProvider user={user} onLogout={handleLogout}>
        <BackendLoader />
        <Routes>
          <Route path="/login" element={!isLoggedIn ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={isLoggedIn ? <Plan /> : <Navigate to="/login" />} />
          <Route path="/add-food" element={isLoggedIn ? <AddFood /> : <Navigate to="/login" />} />
          <Route path="/add-recipe" element={isLoggedIn ? <AddRecipe /> : <Navigate to="/login" />} />
          <Route path="/edit-recipe/:id" element={isLoggedIn ? <AddRecipe /> : <Navigate to="/login" />} />
          <Route path="/recipe/:id" element={isLoggedIn ? <RecipeDetails /> : <Navigate to="/login" />} />
          <Route path="/product/:id" element={isLoggedIn ? <ProductDetails /> : <Navigate to="/login" />} />
          <Route path="/recipes" element={isLoggedIn ? <Recipes /> : <Navigate to="/login" />} />
          <Route path="/cart" element={isLoggedIn ? <ShoppingList /> : <Navigate to="/login" />} />
          <Route path="/onboarding" element={isLoggedIn ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/profile" element={isLoggedIn ? <Profile /> : <Navigate to="/login" />} />
        </Routes>
      </AppDataProvider>
    </Router>
  );
}

export default App;
