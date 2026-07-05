import { Navigate } from "react-router-dom";
import { resolvePostLoginPath } from "../platform/apps";

/** Redirige /app/profile al inicio — el perfil ahora es un modal superpuesto. */
export function ProfilePage() {
  return <Navigate to={resolvePostLoginPath()} replace />;
}
