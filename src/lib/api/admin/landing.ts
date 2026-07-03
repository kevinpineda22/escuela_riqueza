import { supabase } from "@/lib/supabase";

// Cache local en memoria para evitar llamadas repetidas
let textsCache: Record<string, string> | null = null;
// Promesa en vuelo compartida: si N campos montan a la vez y aún no hay cache,
// todos esperan la MISMA query en lugar de disparar N SELECT idénticos.
let inFlight: Promise<Record<string, string>> | null = null;

export async function getLandingTexts(): Promise<Record<string, string>> {
  if (textsCache) return textsCache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from("landing_texts")
      .select("key, value");

    if (error) {
      console.error("Error fetching landing texts:", error);
      // Fallback a objeto vacío SIN cachearlo: un error transitorio no debe
      // dejar toda la landing en valores por defecto por el resto de la sesión.
      return {};
    }

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    textsCache = map;
    return map;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Invalida el cache para forzar recarga */
export function invalidateLandingTextsCache(): void {
  textsCache = null;
  inFlight = null;
}

export async function updateLandingText(
  key: string,
  value: string
): Promise<boolean> {
  const { error } = await supabase
    .from("landing_texts")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

  if (error) {
    console.error("Error updating landing text:", error);
    return false;
  }

  // Actualiza el cache local también
  if (textsCache) {
    textsCache[key] = value;
  }

  return true;
}
