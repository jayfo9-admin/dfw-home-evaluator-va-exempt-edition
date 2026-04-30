import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address } = await req.json();
    if (!address) return Response.json({ error: 'address required' }, { status: 400 });

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Next Tuesday at 7:30 AM Central (handles DST)
    const now = new Date();
    const tzOffsetStr = new Intl.DateTimeFormat('en', {
      timeZone: 'America/Chicago',
      timeZoneName: 'longOffset',
    }).formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? 'UTC-06:00';
    const match = tzOffsetStr.match(/UTC([+-])(\d+):(\d+)/);
    const centralOffsetHours = match
      ? (match[1] === '-' ? 1 : -1) * (parseInt(match[2]) + parseInt(match[3]) / 60)
      : 6;
    const centralOffsetMs = centralOffsetHours * 60 * 60 * 1000;
    const nowCentral = new Date(now.getTime() - centralOffsetMs);
    const centralDayOfWeek = nowCentral.getDay();
    let daysUntilTuesday = (2 - centralDayOfWeek + 7) % 7;
    if (daysUntilTuesday === 0) daysUntilTuesday = 7;
    const departureDate = new Date(now);
    departureDate.setDate(departureDate.getDate() + daysUntilTuesday);
    departureDate.setUTCHours(7 + centralOffsetHours, 30, 0, 0);
    const departureTime = Math.floor(departureDate.getTime() / 1000);

    const destinations = {
      collins:          '3200 E Renner Rd, Richardson TX 75082',
      coram_deo:        '1301 Abrams Rd, Richardson TX 75081',
      dallas_christian: '1515 Republic Pkwy, Mesquite TX 75150',
      heritage:         'Rockwall, Texas 75087',
      mckinney_christian: '3601 Bois D Arc Rd, McKinney TX 75071',
      garland_christian:  '1516 Lavon Dr, Garland TX 75040',
    };

    const entries = Object.entries(destinations);
    const responses = await Promise.all(
      entries.map(([, dest]) =>
        fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(address)}&destinations=${encodeURIComponent(dest)}&key=${apiKey}&departure_time=${departureTime}&traffic_model=pessimistic`
        ).then(r => r.json())
      )
    );

    const result = {};
    entries.forEach(([key], idx) => {
      const data = responses[idx];
      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const el = data.rows[0].elements[0];
        const durationField = el.duration_in_traffic || el.duration;
        result[key] = Math.round(durationField.value / 60);
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});