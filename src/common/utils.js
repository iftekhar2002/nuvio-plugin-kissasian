/**
 * Utility functions for KissAsian scraping and Nuvio stream formatting.
 */

/**
 * Decode common HTML entities like &#8217;, &amp;, &quot;, &#039;
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Remove noise, punctuation, brackets, and parenthesized metadata from title.
 */
export function cleanTitle(title) {
  if (!title || typeof title !== 'string') return '';
  const decoded = decodeHtmlEntities(title);
  return decoded
    .toLowerCase()
    .replace(/\(.*?\)/g, '')          // remove (2024), (TV Series), etc.
    .replace(/\[.*?\]/g, '')          // remove [Eng Sub], [1080p], etc.
    .replace(/[^a-z0-9\s]/g, ' ')     // replace punctuation with space
    .replace(/\s+/g, ' ')             // collapse spaces
    .trim();
}

/**
 * Check if a candidate title matches the searched query title.
 */
export function titlesMatch(candidate, query) {
  if (!candidate || !query) return false;
  const c = cleanTitle(candidate);
  const q = cleanTitle(query);

  if (c === q) return true;

  const cWords = c.split(' ').filter(Boolean);
  const qWords = q.split(' ').filter(Boolean);

  if (qWords.length === 0 || cWords.length === 0) return false;

  // Single-word search: must match exactly first word
  if (qWords.length === 1) {
    if (cWords[0] === qWords[0]) {
      if (cWords.length === 1) return true;
      const allowedNext = ['extended', 'remastered', 'unrated', 'special', 'movie'];
      if (allowedNext.includes(cWords[1])) return true;
    }
    return false;
  }

  // Prefix match (e.g. "queen of tears" matches "queen of tears special")
  if (c.startsWith(q) || q.startsWith(c)) {
    return true;
  }

  // Check if all query words are contained in candidate title
  const allInCandidate = qWords.every(w => cWords.includes(w));
  if (allInCandidate && Math.abs(cWords.length - qWords.length) <= 3) {
    return true;
  }

  return false;
}

/**
 * Extract 4-digit release year from a string or number.
 */
export function extractYear(str) {
  if (!str) return null;
  const m = String(str).match(/\b(19\d{2}|20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Normalize resolution label for Nuvio.
 */
export function extractQuality(str) {
  if (!str) return '1080p';
  const low = String(str).toLowerCase();
  if (low.includes('2160p') || low.includes('4k') || low.includes('uhd')) return '4K';
  if (low.includes('1080p') || low.includes('fhd')) return '1080p';
  if (low.includes('720p') || low.includes('hd')) return '720p';
  if (low.includes('480p') || low.includes('sd')) return '480p';
  if (low.includes('360p')) return '360p';
  return '1080p';
}

/**
 * Extract episode number from an episode title, number string, or URL slug.
 */
export function extractEpisodeNumber(str) {
  if (!str) return null;
  // Match Episode 5, Ep 5, E5, E05, or standalone digit string "5"
  let m = String(str).match(/Episode[:\s\-]*(\d+)/i);
  if (!m) m = String(str).match(/\bEp[:\s\-]*(\d+)\b/i);
  if (!m) m = String(str).match(/\bE(\d+)\b/i);
  if (!m) m = String(str).match(/^\s*(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Safe fetch with configurable timeout, user-agent, and Hermes/React Native compatibility.
 */
export async function safeFetch(url, options = {}, timeoutMs = 8000) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const fetchOptions = {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...(options.headers || {})
      },
      skipSizeCheck: true // Nuvio Hermes runtime flag
    };

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(url, fetchOptions);
    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
