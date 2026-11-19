-- Esquema inicial: personas, agentes evaluadores, casos parametrizables,
-- asignaciones de casos a personas y el trabajo de cada una.

CREATE TABLE usuarios (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  text NOT NULL,
  nombre                 text NOT NULL,
  password_hash          text NOT NULL,
  rol                    text NOT NULL DEFAULT 'evaluado' CHECK (rol IN ('admin', 'evaluado')),
  activo                 boolean NOT NULL DEFAULT true,
  debe_cambiar_password  boolean NOT NULL DEFAULT true,
  ultimo_acceso          timestamptz,
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email));

-- Biblioteca de agentes evaluadores. Un mismo agente puede participar en varios casos.
CREATE TABLE agentes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,                 -- "Ing. Laura Benítez"
  cargo            text NOT NULL,                 -- "Evaluadora técnica"
  iniciales        text NOT NULL DEFAULT '',      -- avatar: "LB"
  color            text NOT NULL DEFAULT '#1f5f8b',
  mirada           text NOT NULL,                 -- foco de evaluación: "técnica", "económica", "comercial"...
  perfil           text NOT NULL,                 -- personalidad, experiencia y criterios
  instrucciones    text NOT NULL DEFAULT '',      -- reglas adicionales para el prompt
  postura_defecto  text NOT NULL DEFAULT 'moderado' CHECK (postura_defecto IN ('conservador', 'moderado', 'audaz')),
  activo           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now()
);

-- Casos o desafíos. Las secciones de la propuesta se definen por caso:
--   [{ "id": "diagnostico", "tipo": "texto" | "presupuesto" | "flujo", "titulo": "...", "ayuda": "...", "placeholder": "..." }]
CREATE TABLE casos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                text NOT NULL,
  area                  text NOT NULL DEFAULT '',
  dificultad            text NOT NULL DEFAULT 'Intermedia',
  enunciado             text NOT NULL DEFAULT '',
  datos                 jsonb NOT NULL DEFAULT '[]',   -- [{ "clave": "...", "valor": "..." }]
  objetivos             jsonb NOT NULL DEFAULT '[]',   -- ["..."]
  restricciones         jsonb NOT NULL DEFAULT '[]',   -- ["..."]
  referencia            text NOT NULL DEFAULT '',      -- notas para los agentes, ocultas para la persona evaluada
  secciones             jsonb NOT NULL DEFAULT '[]',
  tasa_descuento        numeric(6, 2) NOT NULL DEFAULT 12,
  moneda                text NOT NULL DEFAULT 'USD',
  publicado             boolean NOT NULL DEFAULT false,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);

-- Qué agentes evalúan cada caso, en qué orden, con qué postura y con qué enfoque particular.
CREATE TABLE caso_agentes (
  caso_id    uuid NOT NULL REFERENCES casos (id) ON DELETE CASCADE,
  agente_id  uuid NOT NULL REFERENCES agentes (id) ON DELETE RESTRICT,
  orden      integer NOT NULL DEFAULT 0,
  postura    text NOT NULL DEFAULT 'moderado' CHECK (postura IN ('conservador', 'moderado', 'audaz')),
  enfoque    text NOT NULL DEFAULT '',   -- instrucciones del agente específicas de este caso
  PRIMARY KEY (caso_id, agente_id)
);

-- Un caso asignado a una persona. Guarda su propuesta y el estado del trabajo.
CREATE TABLE asignaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  caso_id         uuid NOT NULL REFERENCES casos (id) ON DELETE RESTRICT,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'aprobada', 'cerrada')),
  fecha_limite    date,
  solucion        jsonb NOT NULL DEFAULT '{}',
  iniciado_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, caso_id)
);
CREATE INDEX asignaciones_caso ON asignaciones (caso_id);

-- Cada envío a revisión: el resultado de todos los agentes del caso.
CREATE TABLE revisiones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id     uuid NOT NULL REFERENCES asignaciones (id) ON DELETE CASCADE,
  numero            integer NOT NULL,
  finanzas          jsonb,
  resultados        jsonb NOT NULL,   -- [{ agenteId, veredicto, puntaje, mensaje, fortalezas, observaciones, preguntas }]
  aprobada          boolean NOT NULL DEFAULT false,
  puntaje_promedio  numeric(4, 2),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asignacion_id, numero)
);

-- Conversaciones: con cada agente (canal 'agente') y con el asistente de consulta (canal 'asistente').
CREATE TABLE mensajes (
  id                bigserial PRIMARY KEY,
  asignacion_id     uuid NOT NULL REFERENCES asignaciones (id) ON DELETE CASCADE,
  canal             text NOT NULL CHECK (canal IN ('agente', 'asistente')),
  agente_id         uuid REFERENCES agentes (id) ON DELETE SET NULL,
  autor             text NOT NULL CHECK (autor IN ('alumno', 'agente', 'asistente')),
  texto             text NOT NULL,
  revision_numero   integer,
  fuentes           jsonb,
  creado_en         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mensajes_asignacion ON mensajes (asignacion_id, id);

-- Mesas de debate entre los agentes del caso y su consenso.
CREATE TABLE debates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id   uuid NOT NULL REFERENCES asignaciones (id) ON DELETE CASCADE,
  intervenciones  jsonb NOT NULL,
  consenso        jsonb NOT NULL,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX debates_asignacion ON debates (asignacion_id, creado_en);
