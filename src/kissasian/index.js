/**
 * KissAsian Stream Provider for Nuvio
 */

import { PROVIDER_NAME, DEFAULT_BASE_URL } from './constants.js';
import { searchTitles, getEpisodesList, getEpisodePlayerInfo, getMirrorEmbedUrl } from './api.js';
import { resolveMetadata } from '../common/tmdb.js';
import { titlesMatch, extractYear } from '../common/utils.js';
import { extractStreamtape } from '../extractors/streamtape.js';

/**
 * KissAsian Stream Resolver for Nuvio
 *
 * @param {string|number} tmdbId - TMDB ID, IMDB ID, or title string
 * @param {'movie'|'tv'} mediaType - 'movie' or 'tv'
 * @param {number|null} season - Season number (1-based, TV only)
 * @param {number|null} episode - Episode number (1-based, TV only)
 * @returns {Promise<Array<Object>>} Array of Nuvio stream objects
 */
export async function getStreams(tmdbId, mediaType, season = null, episode = null) {
  try {
    const settings = (typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS) || {};
    const baseUrl = settings.kissasianBaseUrl || DEFAULT_BASE_URL;
    const customTmdbKey = settings.tmdbApiKey || null;

    // 1. Resolve media metadata (title and release year)
    const meta = await resolveMetadata(tmdbId, mediaType, customTmdbKey);
    if (!meta || !meta.title) {
      console.log(`[KissAsian] Could not resolve metadata for ID: ${tmdbId}`);
      return [];
    }

    const searchQuery = meta.title;
    console.log(`[KissAsian] Searching "${searchQuery}" (${meta.year || 'unknown year'}) [${mediaType}]`);

    // 2. Query KissAsian search
    const results = await searchTitles(baseUrl, searchQuery);
    if (!results || results.length === 0) {
      console.log(`[KissAsian] No search results found for query: "${searchQuery}"`);
      return [];
    }

    // 3. Match candidate titles
    const matches = results.filter(item => {
      if (!titlesMatch(item.title, meta.title)) return false;

      // Year verification if available
      if (meta.year && item.year) {
        if (Math.abs(item.year - meta.year) > 1) {
          return false;
        }
      }
      return true;
    });

    if (matches.length === 0) {
      console.log(`[KissAsian] No matching titles passed filtering for "${meta.title}"`);
      return [];
    }

    console.log(`[KissAsian] Matched ${matches.length} candidate(s):`, matches.map(m => m.title));

    const streams = [];
    const seenUrls = new Set();
    const targetSeason = season ? parseInt(season, 10) : 1;
    const targetEpisode = episode ? parseInt(episode, 10) : 1;

    // Process top matches (up to 3 candidate titles)
    for (const match of matches.slice(0, 3)) {
      let targetEpisodeUrl = null;
      let episodeTitle = '';

      // If mediaType is tv, or if this candidate has an episode list
      const epList = await getEpisodesList(match.url);

      if (epList && epList.length > 0) {
        if (mediaType === 'tv') {
          const epFound = epList.find(e => e.episodeNumber === targetEpisode);
          if (epFound) {
            targetEpisodeUrl = epFound.url;
            episodeTitle = epFound.title;
          }
        } else {
          // Movie: either episode 1 or single entry
          const movieEp = epList.find(e => e.episodeNumber === 1) || epList[0];
          if (movieEp) {
            targetEpisodeUrl = movieEp.url;
            episodeTitle = movieEp.title;
          }
        }
      } else if (mediaType === 'movie') {
        // Standalone movie page without separate episode list
        targetEpisodeUrl = match.url;
        episodeTitle = match.title;
      }

      if (!targetEpisodeUrl) {
        continue;
      }

      console.log(`[KissAsian] Inspecting episode URL: ${targetEpisodeUrl}`);

      // 4. Extract player and mirrors from episode page
      const playerInfo = await getEpisodePlayerInfo(targetEpisodeUrl);
      const mirrors = playerInfo.mirrors || [];

      // Check default iframe if present
      if (playerInfo.defaultIframe) {
        const defaultSrc = playerInfo.defaultIframe;
        if (defaultSrc.includes('strcloud') || defaultSrc.includes('streamtape')) {
          const stStream = await extractStreamtape(defaultSrc, targetEpisodeUrl);
          if (stStream && !seenUrls.has(stStream.url)) {
            seenUrls.add(stStream.url);
            streams.push({
              name: PROVIDER_NAME,
              title: mediaType === 'tv'
                ? `[KissAsian] S${targetSeason}E${targetEpisode} - Streamtape (1080p)`
                : `[KissAsian] Movie - Streamtape (1080p)`,
              url: stStream.url,
              quality: '1080p',
              headers: stStream.headers
            });
          }
        }
      }

      // Check server mirrors concurrently
      const mirrorResults = await Promise.all(
        mirrors.map(async mirror => {
          try {
            const embedUrl = await getMirrorEmbedUrl(mirror.url);
            if (!embedUrl) return null;

            if (embedUrl.includes('strcloud') || embedUrl.includes('streamtape')) {
              const stStream = await extractStreamtape(embedUrl, mirror.url);
              if (stStream) {
                return {
                  name: mirror.name || 'Streamtape',
                  stream: stStream,
                  quality: '1080p'
                };
              }
            }

            return null;
          } catch {
            return null;
          }
        })
      );

      for (const res of mirrorResults) {
        if (!res || !res.stream || seenUrls.has(res.stream.url)) continue;
        seenUrls.add(res.stream.url);

        streams.push({
          name: PROVIDER_NAME,
          title: mediaType === 'tv'
            ? `[KissAsian] S${targetSeason}E${targetEpisode} - ${res.name} (${res.quality})`
            : `[KissAsian] Movie - ${res.name} (${res.quality})`,
          url: res.stream.url,
          quality: res.quality,
          headers: res.stream.headers
        });
      }

      // If we found streams from the primary match, break early
      if (streams.length > 0) {
        break;
      }
    }

    console.log(`[KissAsian] Found ${streams.length} stream(s) for "${meta.title}"`);
    return streams;
  } catch (error) {
    console.log(`[KissAsian] Unexpected error in getStreams:`, error.message);
    return [];
  }
}

/**
 * Nuvio provider settings UI blueprint
 */
export async function onSettings() {
  return [
    { type: 'header', label: 'KissAsian Configuration' },
    {
      type: 'text',
      key: 'kissasianBaseUrl',
      label: 'KissAsian Base URL',
      placeholder: DEFAULT_BASE_URL,
      defaultValue: DEFAULT_BASE_URL,
      description: 'Default: https://kissasian.cam (or alternative domain mirror)'
    },
    { type: 'header', label: 'TMDB Settings' },
    {
      type: 'text',
      key: 'tmdbApiKey',
      label: 'Custom TMDB API Key (Optional)',
      placeholder: 'Enter your personal TMDB API key',
      description: 'Leave blank to use built-in rotating TMDB keys.'
    }
  ];
}
