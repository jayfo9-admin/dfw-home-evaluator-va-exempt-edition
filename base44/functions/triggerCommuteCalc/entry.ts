import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trigger batchCalculateCommutes asynchronously (fire and forget)
    base44.functions.invoke('batchCalculateCommutes', {}).catch((err) => {
      console.error('Async commute calc failed:', err);
    });

    // Return immediately
    return Response.json({ message: 'Commute calculation triggered asynchronously' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});