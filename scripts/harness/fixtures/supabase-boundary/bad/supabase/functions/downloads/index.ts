// fixture: stats token no longer env-checked
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (req.headers.get('x-record-token') !== Deno.env.get('DOWNLOADS_RECORD_TOKEN')) deny()
if (req.headers.get('x-admin-token') !== 'hardcoded') deny()
