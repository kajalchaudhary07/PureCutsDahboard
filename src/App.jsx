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
import AttributesList from "./pages/attributes/AttributesList";
import CreateAttribute from "./pages/attributes/CreateAttribute";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={2500} />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireAdmin />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<PlaceholderPage title="Dashboard" />} />
              <Route path="media" element={<PlaceholderPage title="Media" />} />
              <Route path="products" element={<ProductsList />} />
              <Route path="products/add" element={<AddProduct />} />
              <Route path="products/edit/:id" element={<AddProduct />} />
              <Route path="products/recommended" element={<PlaceholderPage title="Recommended Products" />} />
              <Route path="brands" element={<BrandsList />} />
              <Route path="categories" element={<CategoriesList />} />
              <Route path="subcategories" element={<SubCategoriesList />} />
              <Route path="attributes" element={<AttributesList />} />
              <Route path="attributes/create" element={<CreateAttribute />} />
              <Route path="attributes/edit/:id" element={<CreateAttribute />} />
              <Route path="units" element={<PlaceholderPage title="Units" />} />
              <Route path="customers" element={<PlaceholderPage title="Customers" />} />
              <Route path="orders" element={<PlaceholderPage title="Orders" />} />
              <Route path="product-reviews" element={<PlaceholderPage title="Product Reviews" />} />
              <Route path="banners" element={<PlaceholderPage title="Banners" />} />
              <Route path="coupons" element={<PlaceholderPage title="Coupons" />} />
              <Route path="notifications" element={<PlaceholderPage title="Notifications" />} />
              <Route path="chat" element={<PlaceholderPage title="Chat" />} />
              <Route path="admin" element={<PlaceholderPage title="Admin" />} />
              <Route path="roles" element={<PlaceholderPage title="Roles" />} />
              <Route path="profile" element={<PlaceholderPage title="Profile" />} />
              <Route path="app-settings" element={<PlaceholderPage title="App Settings" />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
