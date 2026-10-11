/**
 * KissAsian (kissasian.cam) Scraping API
 */

import { safeFetch, decodeHtmlEntities, extractYear, extractEpisodeNumber } from '../common/utils.js';

/**
 * Searches KissAsian for drama series or movies.
 *
 * @param {string} baseUrl - Base URL of KissAsian
 * @param {string} query - Title search string
 * @returns {Promise<Array<{ title: string, url: string, year: number|null }>>}
 */
export async function searchTitles(baseUrl, query) {
  if (!query) return [];

  try {
    const searchUrl = `${baseUrl.replace(/\/+$/, '')}/?s=${encodeURIComponent(query)}`;
    const res = await safeFetch(searchUrl);
    if (!res.ok) return [];

    const html = await res.text();
    const results = [];
    const seenUrls = new Set();

    // Strategy 1: Look for .bsx container cards which have title and url
    const bsxMatches = [...html.matchAll(/<div class="bsx">[\s\S]*?<a\s+href="([^"]+)"\s+title="([^"]*)"/gi)];
    for (const match of bsxMatches) {
      const url = match[1].trim();
      const rawTitle = decodeHtmlEntities(match[2].trim());
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({
          title: rawTitle,
          url: url,
          year: extractYear(rawTitle)
        });
      }
    }

    // Strategy 2: Look for article / series links if bsx did not catch all
    const seriesMatches = [...html.matchAll(/<a[^>]+href="(https?:\/\/kissasian\.cam\/series\/[^"]+)"[^>]*title="([^"]+)"/gi)];
    for (const match of seriesMatches) {
      const url = match[1].trim();
      const rawTitle = decodeHtmlEntities(match[2].trim());
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        results.push({
          title: rawTitle,
          url: url,
          year: extractYear(rawTitle)
        });
      }
    }

    return results;
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves the episode list from a KissAsian series/movie page.
 *
 * @param {string} seriesUrl - URL of the drama series (e.g. /series/queen-of-tears/)
 * @returns {Promise<Array<{ episodeNumber: number, url: string, title: string }>>}
 */
export async function getEpisodesList(seriesUrl) {
  if (!seriesUrl) return [];

  try {
    const res = await safeFetch(seriesUrl);
    if (!res.ok) return [];

    const html = await res.text();
    const episodes = [];
    const seenUrls = new Set();

    // Match <li data-index="..."> ... <a href="..."> ... <div class="epl-num">1</div> ... <div class="epl-title">...</div>
    const epMatches = [...html.matchAll(/<li[^>]*data-index="(\d+)"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div\s+class="epl-num">([^<]*)<\/div>[\s\S]*?<div\s+class="epl-title">([^<]*)<\/div>/gi)];

    for (const match of epMatches) {
      const url = match[2].trim();
      const numStr = match[3].trim();
      const title = decodeHtmlEntities(match[4].trim());
      const epNum = extractEpisodeNumber(numStr) || extractEpisodeNumber(title);

      if (url && epNum !== null && !seenUrls.has(url)) {
        seenUrls.add(url);
        epEpisodesPush(episodes, epNum, url, title);
      }
    }

    // Fallback if data-index with epl-num was not present: match generic <li> with episode links
    if (episodes.length === 0) {
      const genericMatches = [...html.matchAll(/<a\s+href="([^"]+)"[^>]*>[\s\S]*?(?:Episode\s*(\d+)|Ep\s*(\d+))[\s\S]*?<\/a>/gi)];
      for (const match of genericMatches) {
        const url = match[1].trim();
        const epNum = parseInt(match[2] || match[3], 10);
        if (url && !isNaN(epNum) && !seenUrls.has(url)) {
          seenUrls.add(url);
          epEpisodesPush(episodes, epNum, url, `Episode ${epNum}`);
        }
      }
    }

    return episodes;
  } catch (err) {
    return [];
  }
}

function epEpisodesPush(episodes, epNum, url, title) {
  episodes.push({
    episodeNumber: epNum,
    url: url,
    title: title
  });
}

/**
 * Retrieves video server mirrors and default player from an episode page.
 *
 * @param {string} episodeUrl - e.g. https://kissasian.cam/queen-of-tears-episode-1/
 * @returns {Promise<{ mirrors: Array<{ name: string, url: string }>, defaultIframe: string|null }>}
 */
export async function getEpisodePlayerInfo(episodeUrl) {
  if (!episodeUrl) return { mirrors: [], defaultIframe: null };

  try {
    const res = await safeFetch(episodeUrl);
    if (!res.ok) return { mirrors: [], defaultIframe: null };

    const html = await res.text();

    // 1. Extract mirrors from <select class="mirror">
    const mirrors = [];
    const selectMatch = html.match(/<select[^>]*class="[^"]*mirror[^"]*"[^>]*>([\s\S]*?)<\/select>/i);
    if (selectMatch) {
      const options = [...selectMatch[1].matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/gi)];
      for (const opt of options) {
        const val = opt[1].trim();
        const name = decodeHtmlEntities(opt[2].trim());
        if (val && val.startsWith('http')) {
          mirrors.push({ name, url: val });
        }
      }
    }

    // 2. Extract default embed iframe if present
    const iframeMatch = html.match(/<div class="player-embed"[^>]*>\s*<iframe[^>]+src="([^"]+)"/i) ||
                        html.match(/<iframe[^>]+src="([^"]+)"[^>]*class="iframe-class"/i);
    const defaultIframe = iframeMatch ? iframeMatch[1].trim() : null;

    return { mirrors, defaultIframe };
  } catch (err) {
    return { mirrors: [], defaultIframe: null };
  }
}

/**
 * Retrieves the iframe embed URL from a specific server mirror page.
 *
 * @param {string} mirrorUrl - e.g. https://kissasian.cam/queen-of-tears-episode-1/v/2/
 * @returns {Promise<string|null>}
 */
export async function getMirrorEmbedUrl(mirrorUrl) {
  if (!mirrorUrl) return null;

  try {
    const res = await safeFetch(mirrorUrl);
    if (!res.ok) return null;

    const html = await res.text();
    const iframeMatch = html.match(/<div class="player-embed"[^>]*>\s*<iframe[^>]+src="([^"]+)"/i) ||
                        html.match(/<iframe[^>]+src="([^"]+)"/i);

    return iframeMatch ? iframeMatch[1].trim() : null;
  } catch (err) {
    return null;
  }
}
