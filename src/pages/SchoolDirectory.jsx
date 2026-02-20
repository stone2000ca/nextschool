import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, MapPin, Users, BookOpen, DollarSign, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Navbar from '@/components/navigation/Navbar';
import Footer from '@/components/navigation/Footer';

export default function SchoolDirectory() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedCurriculum, setSelectedCurriculum] = useState('all');
  const [minGrade, setMinGrade] = useState('all');
  const [maxGrade, setMaxGrade] = useState('all');
  const [minTuition, setMinTuition] = useState('all');
  const [maxTuition, setMaxTuition] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    loadSchools();
  }, []);

  const loadSchools = async () => {
    try {
      const data = await base44.entities.School.list('-updated_date', 1000);
      const activeSchools = data.filter(s => s.status === 'active' && s.verified);
      setSchools(activeSchools);
    } catch (error) {
      console.error('Failed to load schools:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndSortedSchools = () => {
    let filtered = schools.filter(school => {
      const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           school.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = selectedCountry === 'all' || school.country === selectedCountry;
      const matchesProvince = selectedProvince === 'all' || school.provinceState === selectedProvince;
      const matchesCurriculum = selectedCurriculum === 'all' || school.curriculumType === selectedCurriculum;
      
      const matchesGrade = (minGrade === 'all' || !school.lowestGrade || school.highestGrade >= minGrade) &&
                          (maxGrade === 'all' || !school.highestGrade || school.lowestGrade <= maxGrade);
      
      const tuition = school.tuition || 0;
      const matchesTuition = (minTuition === 'all' || tuition >= minTuition) &&
                            (maxTuition === 'all' || tuition <= maxTuition);

      return matchesSearch && matchesCountry && matchesProvince && matchesCurriculum && matchesGrade && matchesTuition;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'tuition':
          aVal = a.tuition || 0;
          bVal = b.tuition || 0;
          break;
        case 'location':
          aVal = (a.city + a.provinceState).toLowerCase();
          bVal = (b.city + b.provinceState).toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredSchools = getFilteredAndSortedSchools();
  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedSchools = filteredSchools.slice(startIdx, startIdx + itemsPerPage);

  const provinces = [...new Set(schools.map(s => s.provinceState).filter(Boolean))].sort();
  const countries = [...new Set(schools.map(s => s.country).filter(Boolean))].sort();
  const curriculums = [...new Set(schools.map(s => s.curriculumType).filter(Boolean))].sort();
  const grades = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tuitionRanges = [
    { label: 'Under $20K', min: 0, max: 20000 },
    { label: '$20K - $35K', min: 20000, max: 35000 },
    { label: '$35K - $60K', min: 35000, max: 60000 },
    { label: 'Over $60K', min: 60000, max: 999999 }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-3">School Directory</h1>
          <p className="text-xl text-slate-300">Browse {schools.length} verified schools across Canada, the US, and Europe</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search by school name or city..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-12 py-6 text-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-50 rounded-lg p-6 sticky top-20 space-y-6">
              <h3 className="font-bold text-lg text-slate-900">Filters</h3>

              {/* Country Filter */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Country</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">All Countries</option>
                  {countries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Province Filter */}
              {selectedCountry !== 'all' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Province/State</label>
                  <select
                    value={selectedProvince}
                    onChange={(e) => {
                      setSelectedProvince(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="all">All Provinces/States</option>
                    {provinces
                      .filter(p => !selectedCountry || schools.find(s => s.provinceState === p && s.country === selectedCountry))
                      .map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Curriculum Filter */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Curriculum</label>
                <select
                  value={selectedCurriculum}
                  onChange={(e) => {
                    setSelectedCurriculum(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">All Curriculums</option>
                  {curriculums.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Grade Range */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">From Grade</label>
                <select
                  value={minGrade}
                  onChange={(e) => {
                    setMinGrade(e.target.value === 'all' ? 'all' : parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">Any Grade</option>
                  {grades.map(g => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              {/* Tuition Range */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tuition Range</label>
                <select
                  value={minTuition === 'all' ? 'all' : `${minTuition}-${maxTuition}`}
                  onChange={(e) => {
                    if (e.target.value === 'all') {
                      setMinTuition('all');
                      setMaxTuition('all');
                    } else {
                      const [min, max] = e.target.value.split('-').map(Number);
                      setMinTuition(min);
                      setMaxTuition(max);
                    }
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">Any Tuition</option>
                  {tuitionRanges.map(r => (
                    <option key={r.label} value={`${r.min}-${r.max}`}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Sort Controls */}
            <div className="flex items-center justify-between mb-6 pb-6 border-b">
              <p className="text-slate-600">Showing {paginatedSchools.length} of {filteredSchools.length} schools</p>
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="name">Sort by Name</option>
                  <option value="tuition">Sort by Tuition</option>
                  <option value="location">Sort by Location</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Schools Grid */}
            {paginatedSchools.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 text-lg">No schools match your filters. Try adjusting your search.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {paginatedSchools.map(school => (
                    <Link key={school.id} to={`${createPageUrl('SchoolProfile')}?id=${school.id}`}>
                      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col">
                        {/* Hero Image */}
                        {school.heroImage || school.headerPhotoUrl ? (
                          <img
                            src={school.heroImage || school.headerPhotoUrl}
                            alt={school.name}
                            className="h-48 w-full object-cover"
                          />
                        ) : (
                          <div className="h-48 w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                        )}

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-slate-900 mb-2">{school.name}</h3>

                          {/* Location */}
                          <div className="flex items-center gap-2 text-slate-600 mb-3 text-sm">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{school.city}, {school.provinceState}</span>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                            {school.gradesServed && (
                              <div className="flex items-center gap-2 text-slate-600">
                                <Users className="h-4 w-4 flex-shrink-0" />
                                <span>{school.gradesServed}</span>
                              </div>
                            )}
                            {school.curriculumType && (
                              <div className="flex items-center gap-2 text-slate-600">
                                <BookOpen className="h-4 w-4 flex-shrink-0" />
                                <span>{school.curriculumType}</span>
                              </div>
                            )}
                          </div>

                          {/* Tuition */}
                          {school.tuition && (
                            <div className="flex items-center gap-2 text-teal-600 font-semibold mb-4 text-sm">
                              <DollarSign className="h-4 w-4 flex-shrink-0" />
                              <span>${school.tuition.toLocaleString()}/year</span>
                            </div>
                          )}

                          {/* View Profile Button */}
                          <Button className="w-full bg-teal-600 hover:bg-teal-700 gap-2 mt-auto">
                            View Profile
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-12">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        className={currentPage === page ? 'bg-teal-600' : ''}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}