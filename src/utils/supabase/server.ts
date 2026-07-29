import { createServerClient } from "@supabase/ssr";

// Fallback to Vite environment in case this is built in a client-side Vite project
const supabaseUrl = (typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_SUPABASE_URL : '') || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = (typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : '') || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Mock next/headers if not present in compile targets
type CookiesMock = {
  getAll: () => any[];
  set: (name: string, value: string, options: any) => void;
};

export const createClient = (cookieStore: CookiesMock) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    },
  );
};
