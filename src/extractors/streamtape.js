/**
 * Streamtape / Strcloud Direct MP4 Stream Extractor
 */

import { safeFetch } from '../common/utils.js';

/**
 * Extracts direct MP4 video link from a Streamtape / Strcloud embed URL.
 *
 * @param {string} embedUrl - e.g. https://strcloud.in/e/lgWbRXGmrvC7gxk
 * @param {string} [referer] - Calling page referer (e.g. kissasian.cam)
 * @returns {Promise<{ url: string, headers: Object } | null>}
 */
export async function extractStreamtape(embedUrl, referer = 'https://kissasian.cam/') {
  if (!embedUrl || typeof embedUrl !== 'string') return null;

  try {
    const res = await safeFetch(embedUrl, {
      headers: {
        'Referer': referer,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, 8000);

    if (!res.ok) {
      return null;
    }

    const html = await res.text();

    // Check for deleted videos
    if (html.includes('Video not found') || html.includes('File was deleted') || html.includes('video has been deleted')) {
      return null;
    }

    // Match document.getElementById('robotlink').innerHTML = ...
    // or other variations like ideoolink, ideoooolink, botlink
    const robotMatch = html.match(/document\.getElementById\(['"]robotlink['"]\)\.innerHTML\s*=\s*([^;]+);/i) ||
                       html.match(/document\.getElementById\(['"](?:ideoooolink|ideoolink|botlink)['"]\)\.innerHTML\s*=\s*([^;]+);/i);

    if (!robotMatch) {
      return null;
    }

    const expr = robotMatch[1].trim();
    let streamUrl = null;

    try {
      // Evaluate string concatenation and substring functions safely
      streamUrl = Function(`"use strict"; return (${expr});`)();
    } catch {
      // Fallback manual token extractor if eval is restricted
      const tokenMatch = expr.match(/get_video\?[^'"]+/);
      const hostMatch = embedUrl.match(/https?:\/\/([^\/]+)/);
      if (tokenMatch && hostMatch) {
        streamUrl = `https://${hostMatch[1]}/${tokenMatch[0]}`;
      }
    }

    if (!streamUrl || typeof streamUrl !== 'string') {
      return null;
    }

    if (streamUrl.startsWith('//')) {
      streamUrl = 'https:' + streamUrl;
    } else if (!streamUrl.startsWith('http')) {
      streamUrl = 'https://' + streamUrl.replace(/^\/+/, '');
    }

    // Add Streamtape token parameter (&stream=1) if needed, though direct link already has valid token
    return {
      url: streamUrl,
      headers: {
        'Referer': embedUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
  } catch (err) {
    return null;
  }
}
