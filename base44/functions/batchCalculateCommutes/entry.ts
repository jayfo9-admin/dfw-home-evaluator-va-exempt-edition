import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all homes — cap at 100, matching frontend limit
    const homes = await base44.asServiceRole.entities.Home.list('-created_date', 100);

    if (!homes || homes.length === 0) {
      return Response.json({ message: 'No homes to process', processed: 0 });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Get next Tuesday at 7:30 AM Central Time (for consistent peak-hour traffic).
    // Use Intl.DateTimeFormat longOffset to read the real UTC offset — handles DST
    // correctly including the March/November transition days where month-based checks fail.
    const now = new Date();

    const tzOffsetStr = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Chicago',
      timeZoneName: 'longOffset',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'UTC-06:00';
    // tzOffsetStr: "UTC-06:00" (CST) or "UTC-05:00" (CDT)
    const match = tzOffsetStr.match(/UTC([+-])(\d+):(\d+)/);
    const centralOffsetHours = match
      ? (match[1] === '-' ? 1 : -1) * (parseInt(match[2]) + parseInt(match[3]) / 60)
      : 6; // safe fallback: CST

    const centralOffsetMs = centralOffsetHours * 60 * 60 * 1000;
    const nowCentral = new Date(now.getTime() - centralOffsetMs);
    const centralDayOfWeek = nowCentral.getDay();

    let daysUntilTuesday = (2 - centralDayOfWeek + 7) % 7;
    if (daysUntilTuesday === 0) daysUntilTuesday = 7;

    const departureDate = new Date(now);
    departureDate.setDate(departureDate.getDate() + daysUntilTuesday);
    departureDate.setUTCHours(7 + centralOffsetHours, 30, 0, 0);
    const departureTime = Math.floor(departureDate.getTime() / 1000);

    const collins = '3200 E Renner Rd, Richardson TX 75082';
    const schools = {
      coram_deo: '1301 Abrams Rd, Richardson TX 75081',
      dallas_christian: '1515 Republic Pkwy, Mesquite TX 75150',
      heritage: 'Rockwall, Texas 75087',
      mckinney_christian: '3601 Bois D Arc Rd, McKinney TX 75071',
      garland_christian: '1516 Lavon Dr, Garland TX 75040',
    };

    let processed = 0;
    let failed = 0;

    for (const home of homes) {
      if (!home.address) continue;

      const origin = `${home.address}${home.city ? ', ' + home.city : ''}${home.zip_code ? ' ' + home.zip_code : ''}`;

      try {
        // Call Google Maps API for Collins + all 5 schools with pessimistic traffic model
        const schoolKeys = Object.keys(schools);
        const requests = [
          fetch(
            `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(collins)}&key=${apiKey}&departure_time=${departureTime}&traffic_model=pessimistic`
          ),
          ...schoolKeys.map(key =>
            fetch(
              `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(schools[key])}&key=${apiKey}&departure_time=${departureTime}&traffic_model=pessimistic`
            )
          ),
        ];

        const responses = await Promise.all(requests);
        const datas = await Promise.all(responses.map(r => r.json()));

        let commute_collins_min = null;
        const schoolCommutes = {};

        if (datas[0].status === 'OK' && datas[0].rows[0]?.elements[0]?.status === 'OK') {
          const durationField = datas[0].rows[0].elements[0].duration_in_traffic || datas[0].rows[0].elements[0].duration;
          commute_collins_min = Math.round(durationField.value / 60);
        }

        schoolKeys.forEach((key, idx) => {
          const data = datas[idx + 1];
          if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
            const durationField = data.rows[0].elements[0].duration_in_traffic || data.rows[0].elements[0].duration;
            schoolCommutes[`commute_${key}_min`] = Math.round(durationField.value / 60);
          }
        });

        // Update home with commute times if we got them
        if (commute_collins_min !== null || Object.keys(schoolCommutes).length > 0) {
          await base44.asServiceRole.entities.Home.update(home.id, {
            commute_collins_min,
            ...schoolCommutes,
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