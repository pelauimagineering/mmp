// Public Supabase project credentials. These ship to the browser —
// that's expected. Writes are gated by row-level security (anon role
// has no INSERT/UPDATE access on rounds/results) and the score-entry
// passphrase verified inside the enter_round() RPC.
//
// To rotate: update the values here and redeploy.

export const SUPABASE_URL = 'https://jgzgyodxvounnirgmggl.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_MFxQU33CYCPWPa0j9VbVJA_bqIDS-sN';
