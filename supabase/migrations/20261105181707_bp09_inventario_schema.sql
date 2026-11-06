-- BP09: inventario multi-ubicación, lotes, movimientos y compras.
-- Las migraciones históricas no se modifican. La columna inventario.cantidad_actual
-- se conserva como resumen compatible; inventario_stock_por_ubicacion es la fuente
-- de verdad del saldo.

CREATE SCHEMA IF NOT EXISTS bp09_private;
REVOKE ALL ON SCHEMA bp09_private FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.inventario
  ALTER COLUMN cantidad_actual TYPE numeric(14,3) USING cantidad_actual::numeric(14,3),
  ALTER COLUMN cantidad_minima TYPE numeric(14,3) USING cantidad_minima::numeric(14,3),
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS tipo_item text NOT NULL DEFAULT 'insumo_clinico',
  ADD COLUMN IF NOT EXISTS proveedor_id uuid,
  ADD COLUMN IF NOT EXISTS precio_compra numeric(14,2),
  ADD COLUMN IF NOT EXISTS precio_venta numeric(14,2),
  ADD COLUMN IF NOT EXISTS iva_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cantidad_maxima numeric(14,3),
  ADD COLUMN IF NOT EXISTS punto_reorden numeric(14,3),
  ADD COLUMN IF NOT EXISTS requiere_lote boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requiere_vencimiento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estado_catalogo text NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS estado_instrumental text,
  ADD COLUMN IF NOT EXISTS requiere_esterilizacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS numero_serie text,
  ADD COLUMN IF NOT EXISTS fecha_instalacion date,
  ADD COLUMN IF NOT EXISTS vida_util_horas numeric(12,2),
  ADD COLUMN IF NOT EXISTS ultima_mantencion date,
  ADD COLUMN IF NOT EXISTS proxima_mantencion date,
  ADD COLUMN IF NOT EXISTS origen_local_key text;

UPDATE public.inventario
SET codigo = 'LEG-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE codigo IS NULL OR btrim(codigo) = '';

ALTER TABLE public.inventario
  ALTER COLUMN codigo SET NOT NULL,
  ALTER COLUMN cantidad_actual SET DEFAULT 0,
  ALTER COLUMN cantidad_minima SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_tipo_item_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_tipo_item_check
      CHECK (tipo_item IN ('insumo_clinico', 'instrumental', 'producto_venta', 'implante_protesis', 'equipamiento'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_estado_catalogo_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_estado_catalogo_check
      CHECK (estado_catalogo IN ('activo', 'inactivo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_estado_instrumental_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_estado_instrumental_check
      CHECK (estado_instrumental IS NULL OR estado_instrumental IN ('disponible', 'en_esterilizacion', 'en_uso', 'mantencion'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_producto_venta_campos_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_producto_venta_campos_check
      CHECK (tipo_item <> 'producto_venta' OR (precio_venta IS NOT NULL AND iva_porcentaje = 19));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_tipo_esterilizacion_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_tipo_esterilizacion_check
      CHECK (tipo_item NOT IN ('instrumental', 'implante_protesis') OR requiere_esterilizacion);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_instrumental_estado_requerido_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_instrumental_estado_requerido_check
      CHECK (tipo_item <> 'instrumental' OR estado_instrumental IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_valores_no_negativos_check') THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_valores_no_negativos_check
      CHECK (
        cantidad_actual >= 0
        AND cantidad_minima >= 0
        AND (cantidad_maxima IS NULL OR cantidad_maxima >= 0)
        AND (punto_reorden IS NULL OR punto_reorden >= 0)
        AND (precio_compra IS NULL OR precio_compra >= 0)
        AND (precio_venta IS NULL OR precio_venta >= 0)
        AND iva_porcentaje BETWEEN 0 AND 100
        AND (vida_util_horas IS NULL OR vida_util_horas > 0)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventario_id_clinica_unique'
      AND conrelid = 'public.inventario'::regclass
  ) THEN
    ALTER TABLE public.inventario ADD CONSTRAINT inventario_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS inventario_clinica_codigo_uidx
  ON public.inventario (clinica_id, lower(btrim(codigo)));
CREATE UNIQUE INDEX IF NOT EXISTS inventario_origen_local_uidx
  ON public.inventario (clinica_id, origen_local_key)
  WHERE origen_local_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventario_clinica_tipo_estado_idx
  ON public.inventario (clinica_id, tipo_item, estado_catalogo);

-- Las referencias cruzadas de BP09 llevan siempre clinica_id para impedir
-- asociaciones entre tenants aunque se conozca el UUID de otro registro.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.sucursales'::regclass AND conname = 'sucursales_id_clinica_unique') THEN
    ALTER TABLE public.sucursales ADD CONSTRAINT sucursales_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.boxes_clinicos'::regclass AND conname = 'boxes_clinicos_id_clinica_unique') THEN
    ALTER TABLE public.boxes_clinicos ADD CONSTRAINT boxes_clinicos_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.pacientes'::regclass AND conname = 'pacientes_id_clinica_unique') THEN
    ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.prestaciones'::regclass AND conname = 'prestaciones_id_clinica_unique') THEN
    ALTER TABLE public.prestaciones ADD CONSTRAINT prestaciones_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.pagos'::regclass AND conname = 'pagos_id_clinica_unique') THEN
    ALTER TABLE public.pagos ADD CONSTRAINT pagos_id_clinica_unique UNIQUE (id, clinica_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.inventario_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 160),
  rut text,
  contacto_principal text,
  telefono text,
  email text,
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventario_proveedores_rut_uidx
  ON public.inventario_proveedores (clinica_id, lower(btrim(rut)))
  WHERE rut IS NOT NULL AND btrim(rut) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS inventario_proveedores_nombre_activo_uidx
  ON public.inventario_proveedores (clinica_id, lower(btrim(nombre)))
  WHERE estado = 'activo';

ALTER TABLE public.inventario
  ADD CONSTRAINT inventario_proveedor_clinica_fk
  FOREIGN KEY (proveedor_id, clinica_id)
  REFERENCES public.inventario_proveedores (id, clinica_id)
  ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.inventario_ubicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('bodega_central', 'box')),
  sucursal_id uuid,
  box_id uuid,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 120),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (sucursal_id, clinica_id)
    REFERENCES public.sucursales (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (box_id, clinica_id)
    REFERENCES public.boxes_clinicos (id, clinica_id) ON DELETE RESTRICT,
  CHECK (
    (tipo = 'bodega_central' AND box_id IS NULL)
    OR (tipo = 'box' AND box_id IS NOT NULL AND sucursal_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventario_ubicaciones_bodega_activa_uidx
  ON public.inventario_ubicaciones (clinica_id)
  WHERE tipo = 'bodega_central' AND estado = 'activo';
CREATE UNIQUE INDEX IF NOT EXISTS inventario_ubicaciones_box_uidx
  ON public.inventario_ubicaciones (box_id)
  WHERE box_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventario_ubicaciones_clinica_idx
  ON public.inventario_ubicaciones (clinica_id, estado, tipo);

CREATE TABLE IF NOT EXISTS public.inventario_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL,
  codigo_lote text NOT NULL CHECK (char_length(btrim(codigo_lote)) BETWEEN 1 AND 120),
  fecha_vencimiento date,
  fecha_ingreso timestamptz NOT NULL DEFAULT now(),
  proveedor_id uuid,
  legacy boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  UNIQUE (id, inventario_id, clinica_id),
  UNIQUE (clinica_id, inventario_id, codigo_lote),
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (proveedor_id, clinica_id)
    REFERENCES public.inventario_proveedores (id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS inventario_lotes_vencimiento_idx
  ON public.inventario_lotes (clinica_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventario_stock_por_ubicacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL,
  ubicacion_id uuid NOT NULL,
  lote_id uuid,
  cantidad numeric(14,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (clinica_id, inventario_id, ubicacion_id, lote_id),
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (ubicacion_id, clinica_id)
    REFERENCES public.inventario_ubicaciones (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (lote_id, inventario_id, clinica_id)
    REFERENCES public.inventario_lotes (id, inventario_id, clinica_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS inventario_stock_clinica_item_idx
  ON public.inventario_stock_por_ubicacion (clinica_id, inventario_id, ubicacion_id);

CREATE TABLE IF NOT EXISTS public.inventario_ordenes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  folio text NOT NULL,
  proveedor_id uuid NOT NULL,
  sucursal_id uuid,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'pendiente', 'enviada', 'recibida_parcial', 'recibida_completa', 'con_diferencias', 'rechazada', 'cancelada', 'archivada')),
  fecha_pedido timestamptz NOT NULL DEFAULT now(),
  fecha_estimada_entrega date,
  nota text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL,
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, folio),
  UNIQUE (clinica_id, idempotency_key),
  FOREIGN KEY (proveedor_id, clinica_id)
    REFERENCES public.inventario_proveedores (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (sucursal_id, clinica_id)
    REFERENCES public.sucursales (id, clinica_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.inventario_orden_compra_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  orden_compra_id uuid NOT NULL,
  inventario_id uuid NOT NULL,
  cantidad_solicitada numeric(14,3) NOT NULL CHECK (cantidad_solicitada > 0),
  cantidad_recibida numeric(14,3) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  precio_unitario numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (orden_compra_id, clinica_id)
    REFERENCES public.inventario_ordenes_compra (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT,
  CHECK (cantidad_recibida <= cantidad_solicitada)
);

CREATE INDEX IF NOT EXISTS inventario_orden_compra_items_orden_idx
  ON public.inventario_orden_compra_items (clinica_id, orden_compra_id);

CREATE TABLE IF NOT EXISTS public.inventario_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 2 AND 140),
  prestacion_id uuid,
  descripcion text NOT NULL DEFAULT '',
  activo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, clinica_id),
  FOREIGN KEY (prestacion_id, clinica_id)
    REFERENCES public.prestaciones (id, clinica_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS inventario_kits_prestacion_nombre_uidx
  ON public.inventario_kits (clinica_id, prestacion_id, lower(btrim(nombre)))
  WHERE prestacion_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventario_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  kit_id uuid NOT NULL,
  inventario_id uuid NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_id, inventario_id),
  FOREIGN KEY (kit_id, clinica_id)
    REFERENCES public.inventario_kits (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.inventario_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  folio text NOT NULL,
  paciente_id uuid,
  pago_id uuid NOT NULL UNIQUE REFERENCES public.pagos(id) ON DELETE RESTRICT,
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  iva_total numeric(14,2) NOT NULL CHECK (iva_total >= 0),
  total integer NOT NULL CHECK (total >= 0),
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('efectivo', 'debito', 'credito', 'transferencia')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_fingerprint text NOT NULL,
  UNIQUE (id, clinica_id),
  UNIQUE (clinica_id, folio),
  UNIQUE (clinica_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.inventario_venta_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  venta_id uuid NOT NULL,
  inventario_id uuid NOT NULL,
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
  iva_porcentaje numeric(5,2) NOT NULL DEFAULT 19 CHECK (iva_porcentaje BETWEEN 0 AND 100),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0),
  iva_total numeric(14,2) NOT NULL CHECK (iva_total >= 0),
  total integer NOT NULL CHECK (total >= 0),
  UNIQUE (venta_id, inventario_id),
  FOREIGN KEY (venta_id, clinica_id)
    REFERENCES public.inventario_ventas (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.inventario_mantenciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mantencion', 'reparacion', 'instalacion')),
  fecha date NOT NULL DEFAULT current_date,
  descripcion text NOT NULL CHECK (char_length(btrim(descripcion)) BETWEEN 3 AND 1000),
  costo numeric(14,2) CHECK (costo IS NULL OR costo >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.inventario_permisos_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permiso text NOT NULL CHECK (permiso IN ('compras', 'aprobar_compras', 'ajustes', 'transferencias', 'proveedores')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinica_id, user_id, permiso),
  FOREIGN KEY (clinica_id, user_id)
    REFERENCES public.miembros_clinica (clinica_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.inventario_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES public.clinicas(id) ON DELETE RESTRICT,
  inventario_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada_compra', 'entrada_devolucion', 'salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento', 'ajuste', 'transferencia')),
  cantidad numeric(14,3) NOT NULL CHECK (cantidad > 0),
  signo smallint NOT NULL CHECK (signo IN (-1, 1)),
  ubicacion_origen_id uuid,
  ubicacion_destino_id uuid,
  lote_id uuid,
  paciente_id uuid,
  prestacion_id uuid,
  kit_id uuid,
  orden_compra_id uuid,
  orden_compra_item_id uuid,
  venta_id uuid,
  presupuesto_item_id uuid,
  justificacion text,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  idempotency_fingerprint text NOT NULL DEFAULT 'legacy',
  linea smallint NOT NULL CHECK (linea > 0),
  asignacion smallint NOT NULL CHECK (asignacion > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (inventario_id, clinica_id)
    REFERENCES public.inventario (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (ubicacion_origen_id, clinica_id)
    REFERENCES public.inventario_ubicaciones (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (ubicacion_destino_id, clinica_id)
    REFERENCES public.inventario_ubicaciones (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (lote_id, inventario_id, clinica_id)
    REFERENCES public.inventario_lotes (id, inventario_id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (kit_id, clinica_id)
    REFERENCES public.inventario_kits (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (orden_compra_id, clinica_id)
    REFERENCES public.inventario_ordenes_compra (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (orden_compra_item_id, clinica_id)
    REFERENCES public.inventario_orden_compra_items (id, clinica_id) ON DELETE RESTRICT,
  FOREIGN KEY (venta_id, clinica_id)
    REFERENCES public.inventario_ventas (id, clinica_id) ON DELETE RESTRICT,
  CHECK (
    (tipo = 'transferencia' AND ubicacion_origen_id IS NOT NULL AND ubicacion_destino_id IS NOT NULL AND ubicacion_origen_id <> ubicacion_destino_id)
    OR (tipo IN ('entrada_compra', 'entrada_devolucion') AND ubicacion_destino_id IS NOT NULL AND signo = 1)
    OR (tipo IN ('salida_tratamiento', 'salida_venta', 'salida_perdida_vencimiento') AND ubicacion_origen_id IS NOT NULL AND signo = -1)
    OR (tipo = 'ajuste' AND (ubicacion_origen_id IS NOT NULL OR ubicacion_destino_id IS NOT NULL) AND justificacion IS NOT NULL AND char_length(btrim(justificacion)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventario_movimientos_idempotencia_uidx
  ON public.inventario_movimientos (clinica_id, idempotency_key, linea, asignacion);
CREATE INDEX IF NOT EXISTS inventario_movimientos_item_fecha_idx
  ON public.inventario_movimientos (clinica_id, inventario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventario_movimientos_clinica_fecha_idx
  ON public.inventario_movimientos (clinica_id, created_at DESC);

-- Completar referencias compuestas de entidades que ya existían antes de BP09.
ALTER TABLE public.inventario_ventas
  ADD CONSTRAINT inventario_ventas_pago_clinica_fk
  FOREIGN KEY (pago_id, clinica_id) REFERENCES public.pagos (id, clinica_id) ON DELETE RESTRICT;

ALTER TABLE public.inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_prestacion_clinica_fk
  FOREIGN KEY (prestacion_id, clinica_id) REFERENCES public.prestaciones (id, clinica_id) ON DELETE SET NULL (prestacion_id);

ALTER TABLE public.inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_paciente_clinica_fk
  FOREIGN KEY (paciente_id, clinica_id) REFERENCES public.pacientes (id, clinica_id) ON DELETE SET NULL (paciente_id);

ALTER TABLE public.inventario_ventas
  ADD CONSTRAINT inventario_ventas_paciente_clinica_fk
  FOREIGN KEY (paciente_id, clinica_id) REFERENCES public.pacientes (id, clinica_id) ON DELETE SET NULL (paciente_id);

-- Los valores de proveedor de la versión local se conservan como proveedores sin RUT.
INSERT INTO public.inventario_proveedores (clinica_id, nombre)
SELECT DISTINCT i.clinica_id, btrim(i.proveedor)
FROM public.inventario i
WHERE i.proveedor IS NOT NULL AND btrim(i.proveedor) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.inventario i
SET proveedor_id = p.id
FROM public.inventario_proveedores p
WHERE i.proveedor_id IS NULL
  AND i.clinica_id = p.clinica_id
  AND lower(btrim(i.proveedor)) = lower(btrim(p.nombre));

INSERT INTO public.inventario_ubicaciones (clinica_id, tipo, nombre)
SELECT c.id, 'bodega_central', 'Bodega central'
FROM public.clinicas c
ON CONFLICT DO NOTHING;

INSERT INTO public.inventario_ubicaciones (clinica_id, tipo, sucursal_id, box_id, nombre)
SELECT b.clinica_id, 'box', b.sucursal_id, b.id, b.nombre
FROM public.boxes_clinicos b
WHERE b.estado = 'activo'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventario WHERE cantidad_actual < 0 OR cantidad_minima < 0) THEN
    RAISE EXCEPTION 'BP09: inventario legacy contiene saldos negativos; corregir antes de migrar.';
  END IF;
END $$;

INSERT INTO public.inventario_lotes (
  clinica_id, inventario_id, codigo_lote, fecha_vencimiento, fecha_ingreso,
  proveedor_id, legacy, created_by
)
SELECT i.clinica_id, i.id,
       'LEG-' || upper(substr(replace(i.id::text, '-', ''), 1, 8)),
       i.fecha_vencimiento,
       coalesce(i.created_at, now()),
       i.proveedor_id,
       true,
       i.user_id
FROM public.inventario i
ON CONFLICT (clinica_id, inventario_id, codigo_lote) DO NOTHING;

INSERT INTO public.inventario_stock_por_ubicacion (
  clinica_id, inventario_id, ubicacion_id, lote_id, cantidad
)
SELECT i.clinica_id, i.id, u.id, l.id, i.cantidad_actual
FROM public.inventario i
JOIN public.inventario_ubicaciones u
  ON u.clinica_id = i.clinica_id AND u.tipo = 'bodega_central' AND u.estado = 'activo'
JOIN public.inventario_lotes l
  ON l.clinica_id = i.clinica_id AND l.inventario_id = i.id AND l.legacy
ON CONFLICT DO NOTHING;

INSERT INTO public.inventario_movimientos (
  clinica_id, inventario_id, tipo, cantidad, signo, ubicacion_destino_id,
  lote_id, justificacion, actor_user_id, idempotency_key, linea, asignacion
)
SELECT i.clinica_id, i.id, 'ajuste', i.cantidad_actual, 1, u.id, l.id,
       'Saldo inicial migrado desde el inventario anterior.', i.user_id,
       i.id, 1, 1
FROM public.inventario i
JOIN public.inventario_ubicaciones u
  ON u.clinica_id = i.clinica_id AND u.tipo = 'bodega_central' AND u.estado = 'activo'
JOIN public.inventario_lotes l
  ON l.clinica_id = i.clinica_id AND l.inventario_id = i.id AND l.legacy
WHERE i.cantidad_actual > 0
ON CONFLICT (clinica_id, idempotency_key, linea, asignacion) DO NOTHING;

-- La matriz del BP09 se valida en servidor; los permisos aditivos solo amplían
-- compras, aprobación de compras, ajustes, transferencias y proveedores.
CREATE OR REPLACE FUNCTION public.puede_operar_inventario(p_accion text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_clinica_id uuid;
  v_rol public.app_role;
  v_permiso text;
BEGIN
  IF v_user_id IS NULL OR p_accion IS NULL THEN
    RETURN false;
  END IF;

  v_clinica_id := public.clinica_actual();
  IF v_clinica_id IS NULL THEN
    RETURN false;
  END IF;
  v_rol := public.rol_en_clinica_actual();
  IF v_rol IS NULL THEN
    RETURN false;
  END IF;
  IF v_rol = 'admin'::public.app_role THEN
    RETURN true;
  END IF;

  CASE p_accion
    WHEN 'catalogo.ver' THEN RETURN v_rol IN ('asistente'::public.app_role, 'dentista'::public.app_role);
    WHEN 'stock.ver' THEN RETURN v_rol IN ('asistente'::public.app_role, 'dentista'::public.app_role, 'recepcion'::public.app_role);
    WHEN 'movimientos.ver', 'movimientos.registrar' THEN
      RETURN v_rol = 'asistente'::public.app_role;
    WHEN 'alertas.ver' THEN
      RETURN v_rol IN ('asistente'::public.app_role, 'dentista'::public.app_role);
    WHEN 'tratamiento.consumir' THEN
      RETURN v_rol = 'dentista'::public.app_role;
    WHEN 'kits.ver' THEN
      RETURN v_rol IN ('dentista'::public.app_role, 'asistente'::public.app_role);
    WHEN 'ventas.ver', 'ventas.registrar' THEN
      RETURN v_rol = 'recepcion'::public.app_role;
    WHEN 'compras.ver', 'compras.gestionar' THEN v_permiso := 'compras';
    WHEN 'compras.aprobar' THEN v_permiso := 'aprobar_compras';
    WHEN 'proveedores.ver', 'proveedores.gestionar' THEN v_permiso := 'proveedores';
    WHEN 'ajustes.gestionar' THEN v_permiso := 'ajustes';
    WHEN 'transferencias.gestionar' THEN
      IF v_rol = 'asistente'::public.app_role THEN RETURN true; END IF;
      v_permiso := 'transferencias';
    ELSE RETURN false;
  END CASE;

  RETURN EXISTS (
    SELECT 1
    FROM public.inventario_permisos_aditivos p
    WHERE p.clinica_id = v_clinica_id
      AND p.user_id = v_user_id
      AND p.permiso = v_permiso
  );
END;
$function$;
ALTER FUNCTION public.puede_operar_inventario(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.puede_operar_inventario(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_operar_inventario(text) TO authenticated, service_role;

-- Inventario es un catálogo compartido por la clínica; el actor se conserva en user_id
-- al crear y las escrituras posteriores se validan por clínica + permisos.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventario' LOOP
    EXECUTE format('DROP POLICY %I ON public.inventario', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventario_select_bp09 ON public.inventario FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (
      public.puede_operar_inventario('catalogo.ver')
      OR public.puede_operar_inventario('compras.ver')
      OR (public.tiene_rol_en_clinica(ARRAY['recepcion']::public.app_role[]) AND tipo_item = 'producto_venta')
    )
  );
CREATE POLICY inventario_insert_bp09 ON public.inventario FOR INSERT TO authenticated
  WITH CHECK (
    clinica_id = (SELECT public.clinica_actual())
    AND user_id = (SELECT auth.uid())
    AND public.puede_operar_inventario('catalogo.gestionar')
  );
CREATE POLICY inventario_update_bp09 ON public.inventario FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('catalogo.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('catalogo.gestionar'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventario', 'inventario_proveedores', 'inventario_ubicaciones', 'inventario_lotes',
    'inventario_stock_por_ubicacion', 'inventario_ordenes_compra',
    'inventario_orden_compra_items', 'inventario_kits', 'inventario_kit_items',
    'inventario_ventas', 'inventario_venta_items', 'inventario_mantenciones',
    'inventario_permisos_aditivos', 'inventario_movimientos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY inventario_proveedores_select_bp09 ON public.inventario_proveedores FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND (
    public.puede_operar_inventario('proveedores.ver')
    OR public.puede_operar_inventario('compras.ver')
  ));
CREATE POLICY inventario_proveedores_insert_bp09 ON public.inventario_proveedores FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND created_by = (SELECT auth.uid()) AND public.puede_operar_inventario('proveedores.gestionar'));
CREATE POLICY inventario_proveedores_update_bp09 ON public.inventario_proveedores FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('proveedores.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('proveedores.gestionar'));

CREATE POLICY inventario_ubicaciones_select_bp09 ON public.inventario_ubicaciones FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.tiene_rol_en_clinica(ARRAY['admin','asistente','dentista','recepcion']::public.app_role[]));
CREATE POLICY inventario_ubicaciones_insert_bp09 ON public.inventario_ubicaciones FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND created_by = (SELECT auth.uid()) AND public.puede_operar_inventario('ubicaciones.gestionar'));
CREATE POLICY inventario_ubicaciones_update_bp09 ON public.inventario_ubicaciones FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('ubicaciones.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('ubicaciones.gestionar'));

CREATE POLICY inventario_lotes_select_bp09 ON public.inventario_lotes FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND public.puede_operar_inventario('stock.ver')
    AND (public.tiene_rol_en_clinica(ARRAY['recepcion']::public.app_role[]) IS FALSE
      OR EXISTS (
        SELECT 1 FROM public.inventario i
        WHERE i.id = public.inventario_lotes.inventario_id
          AND i.clinica_id = public.inventario_lotes.clinica_id
          AND i.tipo_item = 'producto_venta'
      ))
  );
CREATE POLICY inventario_stock_select_bp09 ON public.inventario_stock_por_ubicacion FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND public.puede_operar_inventario('stock.ver')
    AND (public.tiene_rol_en_clinica(ARRAY['recepcion']::public.app_role[]) IS FALSE
      OR EXISTS (
        SELECT 1 FROM public.inventario i
        WHERE i.id = public.inventario_stock_por_ubicacion.inventario_id
          AND i.clinica_id = public.inventario_stock_por_ubicacion.clinica_id
          AND i.tipo_item = 'producto_venta'
      ))
  );

CREATE POLICY inventario_movimientos_select_bp09 ON public.inventario_movimientos FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('movimientos.ver'));
CREATE POLICY inventario_ordenes_select_bp09 ON public.inventario_ordenes_compra FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.ver'));
CREATE POLICY inventario_ordenes_insert_bp09 ON public.inventario_ordenes_compra FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND created_by = (SELECT auth.uid()) AND public.puede_operar_inventario('compras.gestionar'));
CREATE POLICY inventario_ordenes_update_bp09 ON public.inventario_ordenes_compra FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.gestionar'));
CREATE POLICY inventario_orden_items_select_bp09 ON public.inventario_orden_compra_items FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.ver'));
CREATE POLICY inventario_orden_items_insert_bp09 ON public.inventario_orden_compra_items FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.gestionar'));
CREATE POLICY inventario_orden_items_update_bp09 ON public.inventario_orden_compra_items FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('compras.gestionar'));

CREATE POLICY inventario_kits_select_bp09 ON public.inventario_kits FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.ver'));
CREATE POLICY inventario_kits_insert_bp09 ON public.inventario_kits FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND created_by = (SELECT auth.uid()) AND public.puede_operar_inventario('kits.gestionar'));
CREATE POLICY inventario_kits_update_bp09 ON public.inventario_kits FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'));
CREATE POLICY inventario_kit_items_select_bp09 ON public.inventario_kit_items FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.ver'));
CREATE POLICY inventario_kit_items_insert_bp09 ON public.inventario_kit_items FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'));
CREATE POLICY inventario_kit_items_update_bp09 ON public.inventario_kit_items FOR UPDATE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'))
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'));
CREATE POLICY inventario_kit_items_delete_bp09 ON public.inventario_kit_items FOR DELETE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('kits.gestionar'));

CREATE POLICY inventario_ventas_select_bp09 ON public.inventario_ventas FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('ventas.ver'));
CREATE POLICY inventario_venta_items_select_bp09 ON public.inventario_venta_items FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('ventas.ver'));
CREATE POLICY pagos_bp09_select_ventas_recepcion ON public.pagos FOR SELECT TO authenticated
  USING (
    pagos.clinica_id = (SELECT public.clinica_actual())
    AND public.puede_operar_inventario('ventas.ver')
    AND EXISTS (
      SELECT 1 FROM public.inventario_ventas venta
      WHERE venta.pago_id = pagos.id
        AND venta.clinica_id = pagos.clinica_id
    )
  );
CREATE POLICY inventario_mantenciones_select_bp09 ON public.inventario_mantenciones FOR SELECT TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.puede_operar_inventario('catalogo.ver'));
CREATE POLICY inventario_mantenciones_insert_bp09 ON public.inventario_mantenciones FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND created_by = (SELECT auth.uid()) AND public.puede_operar_inventario('catalogo.gestionar'));

CREATE POLICY inventario_permisos_select_bp09 ON public.inventario_permisos_aditivos FOR SELECT TO authenticated
  USING (
    clinica_id = (SELECT public.clinica_actual())
    AND (user_id = (SELECT auth.uid()) OR public.es_admin_de_clinica_actual())
  );
CREATE POLICY inventario_permisos_insert_bp09 ON public.inventario_permisos_aditivos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (SELECT public.clinica_actual()) AND granted_by = (SELECT auth.uid()) AND public.es_admin_de_clinica_actual());
CREATE POLICY inventario_permisos_delete_bp09 ON public.inventario_permisos_aditivos FOR DELETE TO authenticated
  USING (clinica_id = (SELECT public.clinica_actual()) AND public.es_admin_de_clinica_actual());

REVOKE ALL ON public.inventario_proveedores, public.inventario_ubicaciones,
  public.inventario_lotes, public.inventario_stock_por_ubicacion,
  public.inventario_ordenes_compra, public.inventario_orden_compra_items,
  public.inventario_kits, public.inventario_kit_items, public.inventario_ventas,
  public.inventario_venta_items, public.inventario_mantenciones,
  public.inventario_permisos_aditivos, public.inventario_movimientos
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON public.inventario FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.inventario TO authenticated;
GRANT INSERT (
  id, user_id, nombre, categoria, cantidad_minima, unidad_medida, fecha_vencimiento,
  proveedor, clinica_id, codigo, tipo_item, proveedor_id, precio_compra,
  precio_venta, iva_porcentaje, cantidad_maxima, punto_reorden, requiere_lote,
  requiere_vencimiento, estado_catalogo, estado_instrumental,
  requiere_esterilizacion, numero_serie, fecha_instalacion, vida_util_horas,
  ultima_mantencion, proxima_mantencion, origen_local_key
) ON public.inventario TO authenticated;
GRANT UPDATE (
  nombre, categoria, cantidad_minima, unidad_medida, fecha_vencimiento,
  proveedor, codigo, tipo_item, proveedor_id, precio_compra, precio_venta,
  iva_porcentaje, cantidad_maxima, punto_reorden, requiere_lote,
  requiere_vencimiento, estado_catalogo, estado_instrumental,
  requiere_esterilizacion, numero_serie, fecha_instalacion, vida_util_horas,
  ultima_mantencion, proxima_mantencion
) ON public.inventario TO authenticated;

GRANT SELECT ON public.inventario_proveedores, public.inventario_ubicaciones,
  public.inventario_lotes, public.inventario_stock_por_ubicacion,
  public.inventario_movimientos, public.inventario_ordenes_compra,
  public.inventario_orden_compra_items, public.inventario_kits,
  public.inventario_kit_items, public.inventario_ventas,
  public.inventario_venta_items, public.inventario_mantenciones,
  public.inventario_permisos_aditivos TO authenticated;
GRANT INSERT, UPDATE ON public.inventario_proveedores, public.inventario_ubicaciones TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventario_permisos_aditivos TO authenticated;

-- El libro de movimientos es append-only incluso para operaciones internas.
CREATE OR REPLACE FUNCTION bp09_private.rechazar_edicion_movimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Los movimientos de inventario son inmutables.' USING ERRCODE = '42501';
END;
$function$;
ALTER FUNCTION bp09_private.rechazar_edicion_movimiento() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp09_private.rechazar_edicion_movimiento() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER inventario_movimientos_append_only
  BEFORE UPDATE OR DELETE ON public.inventario_movimientos
  FOR EACH ROW EXECUTE FUNCTION bp09_private.rechazar_edicion_movimiento();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventario', 'inventario_proveedores', 'inventario_ubicaciones',
    'inventario_stock_por_ubicacion', 'inventario_ordenes_compra',
    'inventario_orden_compra_items', 'inventario_kits'
  ] LOOP
    IF t = 'inventario' THEN
      EXECUTE 'DROP TRIGGER IF EXISTS update_inventario_updated_at ON public.inventario';
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'trg_' || t || '_updated_at', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'inventario', 'inventario_proveedores', 'inventario_ubicaciones',
    'inventario_lotes', 'inventario_ordenes_compra', 'inventario_orden_compra_items',
    'inventario_kits', 'inventario_kit_items', 'inventario_ventas',
    'inventario_venta_items', 'inventario_mantenciones', 'inventario_permisos_aditivos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio()', 'trg_' || t || '_audit', t);
  END LOOP;
  EXECUTE 'DROP TRIGGER IF EXISTS trg_inventario_movimientos_audit ON public.inventario_movimientos';
  EXECUTE 'CREATE TRIGGER trg_inventario_movimientos_audit AFTER INSERT ON public.inventario_movimientos FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio()';
END $$;

-- Crear una ubicación de box cuando BP08 crea o reactiva un box.
CREATE OR REPLACE FUNCTION bp09_private.sincronizar_ubicacion_box()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.estado = 'activo' THEN
    INSERT INTO public.inventario_ubicaciones (clinica_id, tipo, sucursal_id, box_id, nombre)
    VALUES (NEW.clinica_id, 'box', NEW.sucursal_id, NEW.id, NEW.nombre)
    ON CONFLICT (box_id) WHERE box_id IS NOT NULL
    DO UPDATE SET sucursal_id = EXCLUDED.sucursal_id, nombre = EXCLUDED.nombre, estado = 'activo', updated_at = now();
  ELSE
    UPDATE public.inventario_ubicaciones
    SET estado = 'inactivo', updated_at = now()
    WHERE box_id = NEW.id AND clinica_id = NEW.clinica_id;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION bp09_private.sincronizar_ubicacion_box() OWNER TO postgres;
REVOKE ALL ON FUNCTION bp09_private.sincronizar_ubicacion_box() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_bp09_box_location ON public.boxes_clinicos;
CREATE TRIGGER trg_bp09_box_location
  AFTER INSERT OR UPDATE OF estado, nombre, sucursal_id ON public.boxes_clinicos
  FOR EACH ROW EXECUTE FUNCTION bp09_private.sincronizar_ubicacion_box();

-- Publicación de eventos de sincronización para las vistas y servicios de BP09.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventario_proveedores', 'inventario_ubicaciones', 'inventario_lotes',
    'inventario_stock_por_ubicacion', 'inventario_movimientos',
    'inventario_ordenes_compra', 'inventario_orden_compra_items',
    'inventario_kits', 'inventario_kit_items', 'inventario_ventas',
    'inventario_venta_items', 'inventario_mantenciones', 'inventario_permisos_aditivos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.inventario_stock_por_ubicacion IS
  'BP09: saldo canónico por clínica, item, box/bodega y lote; solo se modifica desde RPC transaccional.';
COMMENT ON TABLE public.inventario_movimientos IS
  'BP09: libro append-only de los siete tipos de movimiento. Cada fila conserva actor, clínica, lote, ubicación e idempotencia.';
