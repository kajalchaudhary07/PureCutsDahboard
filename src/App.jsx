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
import ProductReviews from "./pages/reviews/ProductReviews";
import AdminManagement from "./pages/admin/AdminManagement";
import RolesManagement from "./pages/roles/RolesManagement";
import OrdersList from "./pages/orders/OrdersList";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import ChatPage from "./pages/chat/ChatPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import MediaPage from "./pages/media/MediaPage";
import UnitsPage from "./pages/units/UnitsPage";
import CustomersPage from "./pages/customers/CustomersPage";
import BannersPage from "./pages/banners/BannersPage";
import CouponsPage from "./pages/coupons/CouponsPage";
import ProfilePage from "./pages/profile/ProfilePage";
import AppSettingsPage from "./pages/settings/AppSettingsPage";

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
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="media" element={<MediaPage />} />
              <Route path="products" element={<ProductsList />} />
              <Route path="products/add" element={<AddProduct />} />
              <Route path="products/edit/:id" element={<AddProduct />} />
              <Route path="brands" element={<BrandsList />} />
              <Route path="categories" element={<CategoriesList />} />
              <Route path="subcategories" element={<SubCategoriesList />} />
              <Route path="attributes" element={<AttributesList />} />
              <Route path="attributes/create" element={<CreateAttribute />} />
              <Route path="attributes/edit/:id" element={<CreateAttribute />} />
              <Route path="units" element={<UnitsPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="orders" element={<OrdersList />} />
              <Route path="product-reviews" element={<ProductReviews />} />
              <Route path="banners" element={<BannersPage />} />
              <Route path="coupons" element={<CouponsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="admin" element={<AdminManagement />} />
              <Route path="roles" element={<RolesManagement />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="app-settings" element={<AppSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
