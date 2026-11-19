import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

const enlace = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm transition ${isActive ? "bg-tinta text-white" : "text-suave hover:bg-black/5 hover:text-tinta"}`;

export default function Layout() {
  const { usuario, salir } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-linea bg-panel px-4 py-2.5 sm:px-6">
        <Link to="/" className="font-semibold tracking-wide"><span className="text-[#8a4b14]">◆</span> Mesa de Expertos</Link>
        <nav className="flex flex-wrap gap-1">
          {esAdmin ? (
            <>
              <NavLink to="/admin" end className={enlace}>Seguimiento</NavLink>
              <NavLink to="/admin/casos" className={enlace}>Casos</NavLink>
              <NavLink to="/admin/agentes" className={enlace}>Agentes</NavLink>
              <NavLink to="/admin/personas" className={enlace}>Personas</NavLink>
            </>
          ) : (
            <NavLink to="/desafios" className={enlace}>Mis desafíos</NavLink>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-suave sm:inline">{usuario?.nombre}</span>
          <NavLink to="/cuenta" className={enlace}>Mi cuenta</NavLink>
          <button className="text-suave hover:text-tinta" onClick={salir}>Salir</button>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
