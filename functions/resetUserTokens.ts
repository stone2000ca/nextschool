import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset tokenBalance to 100
    await base44.auth.updateMe({ tokenBalance: 100 });

    return Response.json({ success: true, message: 'Token balance reset to 100', tokenBalance: 100 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});