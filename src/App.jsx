import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Layout from "./components/Layout";
import { RequireAdmin, RequireAuth } from "./auth/RouteGuards";
import AuthPage from "./pages/auth/AuthPage";
import ProductsList from "./pages/products/ProductsList";
import AddProduct from "./pages/products/AddProduct";
import BrandsList from "./pages/brands/BrandsList";
import CategoriesList from "./pages/categories/CategoriesList";
import SubCategoriesList from "./pages/subcategories/SubCategoriesList";

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={2500} />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireAdmin />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/products" replace />} />
              <Route path="products" element={<ProductsList />} />
              <Route path="products/add" element={<AddProduct />} />
              <Route path="products/edit/:id" element={<AddProduct />} />
              <Route path="brands" element={<BrandsList />} />
              <Route path="categories" element={<CategoriesList />} />
              <Route path="subcategories" element={<SubCategoriesList />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
