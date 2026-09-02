import { useEffect, useState } from 'preact/hooks';
import type { Catalogue } from '../shared/types';
import { api } from './api';

let cache: Catalogue | null = null;
let inflight: Promise<Catalogue> | null = null;

export function loadCatalogue() {
  if (cache) return Promise.resolve(cache);
  if (!inflight)
    inflight = api.catalogue().then((c) => {
      cache = c;
      return c;
    });
  return inflight;
}

export function useCatalogue() {
  const [cat, setCat] = useState<Catalogue | null>(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!cat) loadCatalogue().then(setCat, (e) => setError(String(e.message ?? e)));
  }, []);
  return { catalogue: cat, error };
}
