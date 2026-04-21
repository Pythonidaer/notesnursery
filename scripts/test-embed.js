/**
 * Test deployed Edge Function `embed-note-text` with a real user access token.
 *
 * Env (required):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * Session: Node cannot read the browser's localStorage. This script persists auth
 * in scripts/.embed-test-session.json (same client options as the app: persistSession).
 *
 * To obtain a session without copying a JWT, set once:
 *   SUPABASE_TEST_EMAIL
 *   SUPABASE_TEST_PASSWORD
 * The script signs in before getSession() if those are set.
 *
 * Fallback (one-off): SUPABASE_ACCESS_TOKEN
 *
 * Run: npm run test:embed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_FILE = path.join(__dirname, '.embed-test-session.json');

/** Minimal file-backed storage so persistSession works in Node (not localStorage). */
const storage = {
  getItem(key) {
    try {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      const all = JSON.parse(raw);
      return all[key] ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    let all = {};
    try {
      all = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    } catch {
      /* empty */
    }
    all[key] = value;
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(all), 'utf8');
  },
  removeItem(key) {
    let all = {};
    try {
      all = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    } catch {
      return;
    }
    delete all[key];
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(all), 'utf8');
  },
};

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const url = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');

const supabase = createClient(url, anonKey, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

const testEmail = process.env.SUPABASE_TEST_EMAIL?.trim();
const testPassword = process.env.SUPABASE_TEST_PASSWORD?.trim();
if (testEmail && testPassword) {
  const { error } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (error) throw error;
}

const { data, error: sessionErr } = await supabase.auth.getSession();
if (sessionErr) throw sessionErr;

let token = data.session?.access_token;
if (!token) {
  token = process.env.SUPABASE_ACCESS_TOKEN?.trim() || null;
}

if (!token) {
  console.error(
    'No Supabase session in Node: the browser app stores the session in localStorage, which this script cannot read.\n' +
      'Fix: set SUPABASE_TEST_EMAIL + SUPABASE_TEST_PASSWORD (sign-in from this script, session saved next to this file),\n' +
      'or set SUPABASE_ACCESS_TOKEN for a one-off test.',
  );
  throw new Error('No session found. Log in to your app first.');
}

const endpoint = `${url.replace(/\/$/, '')}/functions/v1/embed-note-text`;
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    apikey: anonKey,
  },
  body: JSON.stringify({ text: 'This is a test note about dogs and animals' }),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = text;
}

console.log(`Status: ${res.status}`);
console.log('Response:', json);

if (json && typeof json === 'object' && Array.isArray(json.embedding)) {
  console.log(`Embedding length: ${json.embedding.length}`);
}

if (!res.ok) {
  process.exitCode = 1;
}
