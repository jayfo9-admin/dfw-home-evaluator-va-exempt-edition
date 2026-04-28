import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const homeId = body.event?.entity_id;

    if (!homeId) {
      return Response.json({ error: 'No home ID in event' }, { status: 400 });
    }

    // Just trigger a frontend refetch — frontend will recalc scores via scoreHome()
    return Response.json({ success: true, homeId, message: 'Home updated, scores will recalc on dashboard' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});