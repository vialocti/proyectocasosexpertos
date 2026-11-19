# Mesa de Expertos: simulador de resolución de casos

Una persona recibe un caso (ingeniería, ciencias económicas u otro tema) y arma la solución paso a paso.
Agentes de IA con perfiles y posturas distintas la evalúan, la corrigen y conversan con ella hasta llegar
a la solución más favorable. El trabajo queda guardado, así cada persona avanza a su ritmo.

## Qué hace

**Personas evaluadas** (ingresan con email y contraseña):
- Ven sus desafíos asignados, con fecha de entrega, y retoman el trabajo cuando quieran: todo se guarda solo.
- Completan las secciones que define cada caso: texto libre, presupuesto (tabla de ítems) y flujo de fondos.
  Con presupuesto y flujo, el sistema calcula en vivo inversión, repago simple y descontado, VAN y TIR.
- Envían la propuesta a revisión: todos los evaluadores del caso responden en paralelo con veredicto,
  puntaje, fortalezas, observaciones por sección y preguntas.
- Chatean con cada evaluador, convocan una mesa de debate entre todos y obtienen un consenso.
- Tienen una calculadora (VAN, TIR, repago, cuota, punto de equilibrio) y un asistente de IA con búsqueda web opcional.

**Administración** (rol admin):
- **Seguimiento:** estado, revisiones y último puntaje de cada persona en cada caso; ver su trabajo en solo lectura,
  cerrar o reabrir la entrega.
- **Casos:** enunciado, datos, objetivos, restricciones, notas de referencia ocultas para los evaluadores,
  secciones de la propuesta y evaluadores (de 1 a N) con postura y enfoque propios del caso.
- **Agentes:** biblioteca de evaluadores con perfil, mirada (técnica, económica, comercial, ambiental…),
  instrucciones y postura por defecto.
- **Personas:** alta con contraseña provisoria, roles, activar o desactivar, restablecer contraseña.

## Estructura

```
backend/                     Node.js + Express + PostgreSQL
  db/migrations/*.sql        Esquema de la base (se aplican en orden)
  db/migrar.js               npm run migrar
  db/semilla.js              npm run semilla: admin inicial, 3 agentes y 4 casos de ejemplo
  db/prueba-api.mjs          Prueba de humo de toda la API
  src/server.js              Arranque, rutas y frontend compilado
  src/auth.js                Login con bcrypt y sesión en cookie httpOnly (JWT)
  src/routes/trabajo.js      Desafíos, propuesta, revisión, chat, debate, asistente
  src/routes/admin.js        Panel de administración
  src/agents.js              Prompts y lógica de los evaluadores (genérica por caso)
  src/llm.js                 Anthropic u OpenAI según AI_PROVIDER
  src/finance.js             Inversión, repago, VAN, TIR
frontend/                    Vite + React + Tailwind CSS
  src/pages/trabajo/         Espacio de trabajo de un desafío
  src/pages/admin/           Seguimiento, casos, agentes, personas
frontend-legacy/             Versión anterior en HTML/JS (solo referencia)
```

## Puesta en marcha (desarrollo)

Requisitos: Node.js 22 y PostgreSQL 14 o superior.

```bash
# 1. Base de datos
createdb casos_expertos

# 2. Backend
cd backend
npm install
cp .env.example .env        # completá DATABASE_URL, JWT_SECRET, ADMIN_* y la API key del proveedor de IA
npm run preparar            # crea las tablas y carga el admin, los agentes y los casos de ejemplo
npm run dev                 # API en http://localhost:3000

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (reenvía /api al backend)
```

Ingresá con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Desde **Personas** creá a las personas evaluadas y desde
**Seguimiento** asignales un caso.

Sin API key del proveedor elegido, el sistema funciona en **modo demo**: los evaluadores responden con reglas
simples, útil para probar la interfaz sin gastar.

## Producción

```bash
cd frontend && npm ci && npm run build      # genera frontend/dist
cd ../backend && npm ci --omit=dev
npm run migrar                              # en cada actualización, aplica las migraciones nuevas
NODE_ENV=production npm start               # sirve la API y el frontend en el mismo puerto
```

Con `NODE_ENV=production` la cookie de sesión exige HTTPS. Para probar por HTTP sin certificado, agregá
`COOKIE_SECURE=false` (solo de forma temporal).

## Variables de entorno (backend/.env)

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL, ej. `postgres://usuario:clave@localhost:5432/casos_expertos` |
| `JWT_SECRET` | Firma de las sesiones. Generalo con `openssl rand -hex 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` | Administrador que crea `npm run semilla` |
| `AI_PROVIDER` | `anthropic` u `openai` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Si `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT` | Si `AI_PROVIDER=openai` |
| `PORT` | Puerto del servidor (3000 por defecto) |

## Pruebas

Con el servidor corriendo (conviene en modo demo, por ejemplo `OPENAI_API_KEY= PORT=3001 npm start`):

```bash
cd backend
BASE=http://localhost:3001 node db/prueba-api.mjs
```

## Próximos pasos sugeridos

- Recuperación de contraseña por email.
- Exportar resultados (CSV o PDF) desde el seguimiento.
- Respuestas en streaming para la revisión y el debate.
- Guardar una copia del caso y de los agentes al asignarlo, para que editar un caso no cambie las evaluaciones en curso.
