/**
 * End-to-end Test Runner for KissAsian Nuvio Provider
 * Tests the compiled bundle in providers/kissasian.js against live endpoints.
 */

const kissasian = require('./providers/kissasian.js');

function validateStreamObject(stream) {
  const issues = [];
  if (!stream || typeof stream !== 'object') {
    return ['Stream is not an object'];
  }
  if (typeof stream.name !== 'string' || !stream.name) issues.push('Missing/invalid "name"');
  if (typeof stream.title !== 'string' || !stream.title) issues.push('Missing/invalid "title"');
  if (typeof stream.url !== 'string' || !stream.url.startsWith('http')) issues.push('Missing/invalid "url"');
  if (typeof stream.quality !== 'string' || !stream.quality) issues.push('Missing/invalid "quality"');
  return issues;
}

async function runTest(label, fn) {
  console.log(`\n========================================`);
  console.log(`▶ Testing: ${label}`);
  console.log(`========================================`);

  try {
    const start = Date.now();
    await fn();
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✔ PASSED (${duration}s)`);
    return true;
  } catch (err) {
    console.error(`✖ FAILED:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Nuvio KissAsian Provider Test Suite...\n');

  let passed = 0;
  let total = 0;

  // Test 1: Interface and Settings validation
  total++;
  if (await runTest('Interface & Settings Schema', async () => {
    if (typeof kissasian.getStreams !== 'function') throw new Error('Missing getStreams export');
    if (typeof kissasian.onSettings !== 'function') throw new Error('Missing onSettings export');

    const settings = await kissasian.onSettings();
    if (!Array.isArray(settings)) throw new Error('onSettings did not return an array');
    console.log(`Settings schema fields: ${settings.length}`);
  })) passed++;

  // Test 2: TV Series Stream Resolution via TMDB ID (Queen of Tears S01E01 - TMDB 215720)
  total++;
  if (await runTest('TMDB ID Resolution (Queen of Tears S01E01 - TMDB: 215720)', async () => {
    const streams = await kissasian.getStreams(215720, 'tv', 1, 1);
    console.log(`Received ${streams.length} stream(s)`);

    if (!Array.isArray(streams) || streams.length === 0) {
      throw new Error('No streams returned for Queen of Tears S01E01');
    }

    const first = streams[0];
    const issues = validateStreamObject(first);
    if (issues.length > 0) {
      throw new Error(`Invalid stream object: ${issues.join(', ')}`);
    }

    console.log('Stream Details:');
    console.log(`  Name:    ${first.name}`);
    console.log(`  Title:   ${first.title}`);
    console.log(`  Quality: ${first.quality}`);
    console.log(`  URL:     ${first.url.slice(0, 80)}...`);

    // Verify stream reachability via HEAD request
    console.log('Checking stream reachability via HEAD request...');
    const res = await fetch(first.url, {
      method: 'HEAD',
      headers: first.headers || {}
    });

    console.log(`  HTTP Status:   ${res.status}`);
    console.log(`  Content-Type:  ${res.headers.get('content-type')}`);
    console.log(`  Content-Length: ${res.headers.get('content-length')} bytes`);

    if (res.status !== 200) {
      throw new Error(`Stream HEAD returned unexpected HTTP status ${res.status}`);
    }
  })) passed++;

  // Test 3: Raw title query resolution (Lovely Runner S01E01)
  total++;
  if (await runTest('Raw Title Resolution (Lovely Runner S01E01)', async () => {
    const streams = await kissasian.getStreams('Lovely Runner', 'tv', 1, 1);
    console.log(`Received ${streams.length} stream(s)`);
    if (!Array.isArray(streams) || streams.length === 0) {
      throw new Error('No streams returned for Lovely Runner S01E01');
    }
    const first = streams[0];
    console.log(`  Stream: ${first.title}`);
    console.log(`  URL:    ${first.url.slice(0, 80)}...`);
  })) passed++;

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${passed}/${total} passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

main();
