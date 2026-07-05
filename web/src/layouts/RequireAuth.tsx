import { Navigate, Outlet } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../contexts/AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
