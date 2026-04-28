import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all homes
    const homes = await base44.asServiceRole.entities.Home.list('-created_date', 1000);

    if (!homes || homes.length === 0) {
      return Response.json({ message: 'No homes to process', processed: 0 });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Get next Tuesday at 7:30 AM (for consistent weekday traffic)
    const now = new Date();
    const dayOfWeek = now.getDay();
    let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    if (daysUntilTuesday === 0) daysUntilTuesday = 7; // If today is Tuesday, use next Tuesday
    
    const departureDate = new Date(now);
    departureDate.setDate(departureDate.getDate() + daysUntilTuesday);
    departureDate.setHours(7, 30, 0, 0);
    const departureTime = Math.floor(departureDate.getTime() / 1000);

    const collins = '3200 E Renner Rd, Richardson TX 75082';
    const coramDeo = '1301 Abrams Rd, Richardson TX 75081';

    let processed = 0;
    let failed = 0;

    for (const home of homes) {
      if (!home.address) continue;

      const origin = `${home.address}${home.city ? ', ' + home.city : ''}${home.zip_code ? ' ' + home.zip_code : ''}`;

      try {
        // Call Google Maps API directly for both destinations with pessimistic traffic model
        const [collinsRes, coramRes] = await Promise.all([
          fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(collins)}&key=${apiKey}&departure_time=${departureTime}&traffic_model=pessimistic`
          ),
          fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(coramDeo)}&key=${apiKey}&departure_time=${departureTime}&traffic_model=pessimistic`
          ),
        ]);

        const collinsData = await collinsRes.json();
        const coramData = await coramRes.json();

        let commute_collins_min = null;
        let commute_coram_deo_min = null;

        if (collinsData.status === 'OK' && collinsData.rows[0]?.elements[0]?.status === 'OK') {
          commute_collins_min = Math.round(collinsData.rows[0].elements[0].duration.value / 60);
        }

        if (coramData.status === 'OK' && coramData.rows[0]?.elements[0]?.status === 'OK') {
          commute_coram_deo_min = Math.round(coramData.rows[0].elements[0].duration.value / 60);
        }

        // Update home with commute times if we got them
        if (commute_collins_min !== null || commute_coram_deo_min !== null) {
          await base44.asServiceRole.entities.Home.update(home.id, {
            commute_collins_min,
            commute_coram_deo_min,
            commute_verified: commute_collins_min !== null,
          });
          processed++;
        }
      } catch (homeErr) {
        console.error(`Failed to calculate commute for ${home.address}:`, homeErr);
        failed++;
      }
    }

    return Response.json({
      message: 'Batch commute calculation complete',
      processed,
      failed,
      departureTime: new Date(departureTime * 1000).toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});