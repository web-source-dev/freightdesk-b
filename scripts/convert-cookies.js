#!/usr/bin/env node
/**
 * Convert cookies.json from Puppeteer/DevTools format to DAT export formats.
 *
 * Usage:
 *   node scripts/convert-cookies.js cookies.json
 *   node scripts/convert-cookies.js cookies.json --out ./exports
 *   node scripts/convert-cookies.js downloaded-sessions/A/cookies.json --session-name "Container A"
 */
const fs = require('fs');
const path = require('path');
const {
  toDatComExport,
  toSessionContainerExport,
} = require('../lib/cookieFormat');

function parseArgs(argv) {
  const args = { input: null, out: null, sessionId: null, sessionName: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    } else if (arg === '--session-id' && argv[i + 1]) {
      args.sessionId = argv[++i];
    } else if (arg === '--session-name' && argv[i + 1]) {
      args.sessionName = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (!arg.startsWith('-') && !args.input) {
      args.input = path.resolve(arg);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Convert cookies.json to DAT export formats.

  node scripts/convert-cookies.js <cookies.json> [options]

Options:
  --out <dir>              Output directory (default: same folder as input)
  --session-id <id>        Session ID for session export format
  --session-name <name>    Session name for session export format
  --help                   Show this help

Outputs:
  dat.com_cookies_<timestamp>.json   (dat.com export format)
  <sessionId>.json                   (full session container format)
`);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.input ? 0 : 1);
  }

  if (!fs.existsSync(args.input)) {
    console.error(`[convert-cookies] File not found: ${args.input}`);
    process.exit(1);
  }

  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  } catch (err) {
    console.error(`[convert-cookies] Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(cookies)) {
    console.error('[convert-cookies] Expected cookies.json to be an array.');
    process.exit(1);
  }

  const outDir = args.out || path.dirname(args.input);
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const sessionId = args.sessionId || path.basename(args.input, '.json') || 'session';

  const datComPath = path.join(outDir, `dat.com_cookies_${timestamp}.json`);
  const sessionPath = path.join(outDir, `${sessionId}.json`);

  const datComExport = toDatComExport(cookies);
  const sessionExport = toSessionContainerExport(cookies, {
    sessionId,
    sessionName: args.sessionName || sessionId,
  });

  writeJson(datComPath, datComExport);
  writeJson(sessionPath, sessionExport);

  console.log(`[convert-cookies] Input: ${args.input} (${cookies.length} cookies)`);
  console.log(`[convert-cookies] DAT export: ${datComPath} (${datComExport['dat.com'].cookies.length} cookies)`);
  console.log(`[convert-cookies] Session export: ${sessionPath} (${sessionExport.cookieCount} cookies)`);
}

main();
