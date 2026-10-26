// Middleware checks current approval and expiry before this route can run.
export const dynamic='force-dynamic';
export function GET(){return Response.json({active:true},{headers:{'Cache-Control':'no-store'}});}
