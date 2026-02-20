import { Sparkles } from 'lucide-react';

export default function ComparisonView({ schools, onBack }) {
  if (!schools || schools.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">No schools to compare</p>
      </div>
    );
  }

  const rows = [
    { label: 'Location', key: (s) => `${s.city}, ${s.region}` },
    { label: 'Grades Served', key: (s) => `${s.lowestGrade}-${s.highestGrade}` },
    { label: 'Enrollment', key: (s) => s.enrollment?.toLocaleString() || 'N/A' },
    { label: 'Tuition', key: (s) => s.tuition ? `${s.currency} ${s.tuition.toLocaleString()}` : 'N/A' },
    { label: 'Curriculum', key: (s) => s.curriculumType || 'N/A' },
    { label: 'Class Size', key: (s) => s.avgClassSize || 'N/A' },
    { label: 'Student:Teacher', key: (s) => s.studentTeacherRatio || 'N/A' },
    { label: 'Specializations', key: (s) => s.specializations?.join(', ') || 'N/A' },
    { label: 'Boarding', key: (s) => s.boardingAvailable ? `Yes (${s.boardingType})` : 'No' },
    { label: 'Financial Aid', key: (s) => s.financialAidAvailable ? 'Available' : 'Not available' },
    { label: 'Founded', key: (s) => s.founded || 'N/A' }
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-2xl font-bold">School Comparison</h2>
          <p className="text-sm text-slate-600">Comparing {schools.length} schools</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="text-left p-4 font-semibold text-sm text-slate-700 sticky left-0 bg-white z-10 w-32">
                    Criteria
                  </th>
                  {schools.map((school) => (
                    <th key={school.id} className="text-left p-0 font-semibold text-sm text-slate-900 min-w-[250px] bg-white">
                      <div className="border-l border-slate-200">
                        {/* Header Photo */}
                        <div className="relative h-32 bg-slate-100 overflow-hidden">
                          {school.headerPhotoUrl ? (
                            <img 
                              src={school.headerPhotoUrl} 
                              alt={school.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                              <Sparkles className="h-8 w-8 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* Logo and Name */}
                        <div className="p-3 border-b border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            {school.logoUrl ? (
                              <img 
                                src={school.logoUrl} 
                                alt={school.name}
                                className="h-6 w-6 rounded object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
                                {school.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-semibold text-slate-900 line-clamp-2">{school.name}</span>
                          </div>
                        </div>

                        {/* Highlights */}
                        {school.highlights && school.highlights.length > 0 && (
                          <div className="p-3 border-b border-slate-200 bg-teal-50">
                            {school.highlights.slice(0, 3).map((highlight, idx) => (
                              <div key={idx} className="flex gap-2 mb-1.5 last:mb-0">
                                <Sparkles className="h-3 w-3 text-teal-600 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-teal-900 leading-snug">{highlight}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-4 font-medium text-sm text-slate-700 sticky left-0 bg-white z-10">
                      {row.label}
                    </td>
                    {schools.map((school) => (
                      <td key={school.id} className="p-4 text-sm text-slate-600 border-l border-slate-200">
                        {row.key(school)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}