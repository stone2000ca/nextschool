import SchoolCard from './SchoolCard';

export default function SchoolGrid({ schools, onViewDetails, onToggleShortlist, shortlistedIds = [] }) {
  if (!schools || schools.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No schools found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {schools.map((school, index) => (
        <div key={school.id} className="w-full sm:w-[250px]">
          <SchoolCard
            school={school}
            index={index}
            onViewDetails={() => onViewDetails(school.id)}
            onToggleShortlist={onToggleShortlist}
            isShortlisted={shortlistedIds.includes(school.id)}
          />
        </div>
      ))}
    </div>
  );
}