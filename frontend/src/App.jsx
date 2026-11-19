import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import { Cargando } from "./components/ui.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Cuenta from "./pages/Cuenta.jsx";
import MisDesafios from "./pages/MisDesafios.jsx";
import Trabajo from "./pages/trabajo/Trabajo.jsx";
import Seguimiento from "./pages/admin/Seguimiento.jsx";
import Casos from "./pages/admin/Casos.jsx";
import CasoEditor from "./pages/admin/CasoEditor.jsx";
import Agentes from "./pages/admin/Agentes.jsx";
import Personas from "./pages/admin/Personas.jsx";

function Protegida({ rol, children }) {
  const { usuario } = useAuth();
  const loc = useLocation();
  if (usuario === undefined) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: loc.pathname }} />;
  if (usuario.debeCambiarPassword && loc.pathname !== "/cuenta") return <Navigate to="/cuenta" replace />;
  if (rol && usuario.rol !== rol) return <Navigate to="/" replace />;
  return children;
}

function Inicio() {
  const { usuario } = useAuth();
  return <Navigate to={usuario?.rol === "admin" ? "/admin" : "/desafios"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegida><Layout /></Protegida>}>
        <Route index element={<Inicio />} />
        <Route path="cuenta" element={<Cuenta />} />
        <Route path="desafios" element={<MisDesafios />} />
        <Route path="desafios/:id" element={<Trabajo />} />
        <Route path="admin" element={<Protegida rol="admin"><Seguimiento /></Protegida>} />
        <Route path="admin/asignaciones/:id" element={<Protegida rol="admin"><Trabajo /></Protegida>} />
        <Route path="admin/casos" element={<Protegida rol="admin"><Casos /></Protegida>} />
        <Route path="admin/casos/:id" element={<Protegida rol="admin"><CasoEditor /></Protegida>} />
        <Route path="admin/agentes" element={<Protegida rol="admin"><Agentes /></Protegida>} />
        <Route path="admin/personas" element={<Protegida rol="admin"><Personas /></Protegida>} />
        <Route path="*" element={<Inicio />} />
      </Route>
    </Routes>
  );
}
