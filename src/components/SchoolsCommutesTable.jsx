export default function SchoolsCommutesTable({ home }) {
  const schools = [
    { key: 'coram_deo', name: 'Coram Deo Academy', time: home.commute_coram_deo_min },
    { key: 'dallas_christian', name: 'Dallas Christian School', time: home.commute_dallas_christian_min },
    { key: 'heritage', name: 'Heritage Christian Academy', time: home.commute_heritage_min },
    { key: 'mckinney_christian', name: 'McKinney Christian Academy', time: home.commute_mckinney_christian_min },
    { key: 'garland_christian', name: 'Garland Christian Academy', time: home.commute_garland_christian_min },
  ];

  const hasAnyCommute = schools.some(s => s.time !== undefined && s.time !== null);

  if (!hasAnyCommute) {
    return (
      <div className="p-3 bg-secondary/30 rounded-lg border border-border">
        <p className="text-xs text-muted-foreground italic">Schools commute times not yet calculated.</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-secondary/30 rounded-lg border border-border">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">School Commutes</p>
      <div className="space-y-1.5">
        {schools.map(school => (
          school.time !== undefined && school.time !== null && (
            <div key={school.key} className="flex justify-between items-center text-sm">
              <span className={school.time <= 30 ? 'text-foreground' : 'text-red-600'}>{school.name}</span>
              <span className={`font-semibold ${school.time <= 30 ? 'text-green-600' : 'text-red-600'}`}>{school.time} min</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}