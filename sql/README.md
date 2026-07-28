# SQL — Esquema de base de datos (Supabase)

Scripts SQL que definen y hacen evolucionar la base de datos en Supabase.

> **Importante:** estos scripts **no se corren solos**. Se ejecutan **a mano** en el
> **SQL Editor de Supabase**. No hay migration runner automático. Son la fuente de
> verdad del esquema (schema-as-code): documentan cómo está armada la base y sirven
> para reprovisionar el entorno desde cero.

Todos son **idempotentes** (`create ... if not exists`, `create or replace`,
`drop ... if exists`), así que re-ejecutarlos es seguro.

---

## Convención de nombres

- `sync_*.sql` — definición viva de una tabla/función/trigger (re-ejecutable).
- `migrate-*.sql` — un cambio puntual de esquema (agregar columna, crear tabla).
- `insert-*.sql` — carga de datos (seeds).

## Orden de aplicación (entorno nuevo)

Si tuvieras que recrear la base desde cero, un orden razonable es:
`sync_signup` → `sync_profiles` → `sync_progress` → `migrate-lives-schema` →
`migrate-recordings-r2` → `sync_platform_settings` → resto de `platform` →
`sync_community*` → `sync_sponsors` → `sync_admin_*` → `migrate-landing-texts` →
`insert-new-keys`.

---

## Catálogo

### Usuarios, perfiles y progreso
| Archivo | Qué hace |
|---|---|
| `sync_signup.sql` | Trigger `handle_new_user`: al registrarse, crea el perfil + la suscripción. |
| `sync_profiles.sql` | Trigger `handle_user_update`: mantiene el email sincronizado en `profiles`. |
| `sync_progress.sql` | Tabla `user_lesson_progress` + RLS + trigger (progreso por lección). |

### Lives y grabaciones
| Archivo | Qué hace |
|---|---|
| `migrate-lives-schema.sql` | Tabla/columnas de `lives` + RLS. |
| `migrate-recordings-r2.sql` | Columnas de archivado en R2 en `lives` (`recording_r2_key`, `recording_storage`, `recording_bytes`, `recording_duration_seconds`, `archived_at`). Ver [`../docs/RECORDINGS_ARCHITECTURE.md`](../docs/RECORDINGS_ARCHITECTURE.md). |

### Configuración de la plataforma
| Archivo | Qué hace |
|---|---|
| `sync_platform_settings.sql` | Tabla `platform_settings` (config global, fila singleton) + RLS + trigger de auditoría. |
| `sync_platform_logo.sql` | Agrega `logo_url` a `platform_settings`. |
| `sync_platform_ads.sql` | Agrega `free_ad_type` y `free_ads_per_block` a `platform_settings`. |

### Comunidad (foro VIP)
| Archivo | Qué hace |
|---|---|
| `sync_community.sql` | Tablas `community_posts`, `community_comments`, `community_likes` + RLS (solo VIP/Admin interactúan). |
| `sync_community_image.sql` | Agrega `image_url` a `community_posts`. |
| `sync_community_individual_storage.sql` | Amplía `is_vip_or_admin` al plan `individual` + Storage de imágenes de comunidad. |

### Patrocinadores / publicidad
| Archivo | Qué hace |
|---|---|
| `sync_sponsors.sql` | Tablas `ad_sponsors` (aliados con peso) + `ad_videos` (videos publicitarios) + RLS. |

### Métricas y acciones de admin
| Archivo | Qué hace |
|---|---|
| `sync_admin_plan.sql` | RPCs `admin_update_user_plan`, `admin_delete_user`. |
| `sync_admin_metrics_v2.sql` | RPCs de métricas con filtro de período: `admin_get_top_lessons`, `admin_count_new_users`, `admin_revenue_in_period`. **Versión vigente.** |
| `sync_admin_metrics.sql` | ⚠️ **Obsoleto.** v1 de `admin_get_top_lessons` (sin período). Reemplazado por `sync_admin_metrics_v2.sql`. Se conserva por historial. |

### Landing editable (Live Edit Mode)
| Archivo | Qué hace |
|---|---|
| `migrate-landing-texts.sql` | Tabla `landing_texts` (textos de la landing editables desde el admin). |
| `insert-new-keys.sql` | Seed: inserta las keys de textos editables en `landing_texts`. |
