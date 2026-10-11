/**
 * TMDB Metadata Resolver with multi-key rotation and IMDB fallback.
 */

import { safeFetch } from './utils.js';

export const DEFAULT_TMDB_KEYS = [
  '1865f43a0549ca50d341dd9ab8b29f49',
  '439c478a771f35c05022f9feabcca01c',
  'b8a6a683a48e77c8e96bf71b3e5cb5b2',
  '8265bd1679663a7ea12ac168da84d2e8'
];

/**
 * Resolves TMDB ID, IMDB ID, or raw title to media metadata:
 * { title, year, imdbId, originalTitle }
 *
 * @param {string|number|Object} tmdbId - TMDB ID, IMDB ID, or title
 * @param {'movie'|'tv'} mediaType - 'movie' or 'tv'
 * @param {string|null} customApiKey - Optional custom TMDB API key
 * @returns {Promise<{title: string, year: number|null, imdbId: string|null}>}
 */
export async function resolveMetadata(tmdbId, mediaType, customApiKey = null) {
  // If tmdbId is passed as an object containing title
  if (typeof tmdbId === 'object' && tmdbId !== null) {
    return {
      title: tmdbId.title || tmdbId.name || '',
      year: parseInt(tmdbId.year || '', 10) || null,
      imdbId: tmdbId.imdbId || tmdbId.imdb_id || null
    };
  }

  const idStr = String(tmdbId || '').trim();

  // If passed directly as a title string rather than numeric ID or 'tt...'
  if (isNaN(idStr) && !idStr.startsWith('tt')) {
    return {
      title: idStr,
      year: null,
      imdbId: null
    };
  }

  const type = mediaType === 'tv' ? 'tv' : 'movie';
  const keys = customApiKey ? [customApiKey, ...DEFAULT_TMDB_KEYS] : DEFAULT_TMDB_KEYS;
  const isImdb = idStr.startsWith('tt');

  for (const apiKey of keys) {
    try {
      const endpoint = isImdb
        ? `https://api.themoviedb.org/3/find/${idStr}?api_key=${apiKey}&external_source=imdb_id`
        : `https://api.themoviedb.org/3/${type}/${idStr}?api_key=${apiKey}&append_to_response=external_ids`;

      const res = await safeFetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      }, 5000);

      if (!res.ok) continue;

      const data = await res.json();

      if (isImdb) {
        const item = type === 'tv'
          ? (data.tv_results?.[0] || data.tv_episode_results?.[0])
          : (data.movie_results?.[0]);

        if (item) {
          const rawDate = item.release_date || item.first_air_date || '';
          return {
            title: item.title || item.name || item.original_title || item.original_name,
            year: parseInt(rawDate.slice(0, 4), 10) || null,
            imdbId: idStr
          };
        }
      } else {
        const rawDate = data.release_date || data.first_air_date || '';
        return {
          title: data.title || data.name || data.original_title || data.original_name,
          year: parseInt(rawDate.slice(0, 4), 10) || null,
          imdbId: data.external_ids?.imdb_id || data.imdb_id || null
        };
      }
    } catch {
      // Continue to next key on network failure
    }
  }

  // Fallback if all keys fail
  return {
    title: idStr,
    year: null,
    imdbId: isImdb ? idStr : null
  };
}
