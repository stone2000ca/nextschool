import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Phone, Mail, Globe, Users, BookOpen, DollarSign, Heart, Share2, ChevronRight, AlertCircle, Loader2, MapPinIcon, Home, Zap, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Navbar from '@/components/navigation/Navbar';
import Footer from '@/components/navigation/Footer';
import { toast } from 'sonner';

export default function SchoolProfile() {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similarSchools, setSimilarSchools] = useState([]);
  const [isShortlisted, setIsShortlisted] = useState(false);

  useEffect(() => {
    loadSchool();
  }, []);

  const loadSchool = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const schoolId = params.get('id');
      
      if (!schoolId) {
        setLoading(false);
        return;
      }

      const schoolData = await base44.entities.School.get(schoolId);
      if (schoolData) {
        setSchool(schoolData);
        await loadSimilarSchools(schoolData);
      }
    } catch (error) {
      console.error('Failed to load school:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSimilarSchools = async (currentSchool) => {
    try {
      const all = await base44.entities.School.list('-updated_date', 100);
      const active = all.filter(s => s.status === 'active' && s.verified && s.id !== currentSchool.id);
      
      const similar = active
        .filter(s => (s.city === currentSchool.city || s.provinceState === currentSchool.provinceState) && s.id !== currentSchool.id)
        .slice(0, 4);
      
      setSimilarSchools(similar);
    } catch (error) {
      console.error('Failed to load similar schools:', error);
    }
  };

  const handleAddToShortlist = () => {
    toast.success('Added to shortlist! Sign in to save permanently.');
    setIsShortlisted(!isShortlisted);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: school.name,
          url: window.location.href
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

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

  if (!school) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-xl text-slate-600">School not found</p>
            <Link to={createPageUrl('SchoolDirectory')}>
              <Button className="mt-6 bg-teal-600 hover:bg-teal-700">Back to Directory</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <div className="relative h-96 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
        {school.heroImage || school.headerPhotoUrl ? (
          <img
            src={school.heroImage || school.headerPhotoUrl}
            alt={school.name}
            className="w-full h-full object-cover opacity-40"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
        
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex items-start justify-between gap-6">
              <div>
                {school.logoUrl && (
                  <img src={school.logoUrl} alt={school.name} className="h-20 w-20 rounded-lg bg-white p-2 mb-4 object-contain" />
                )}
                <h1 className="text-5xl font-bold text-white mb-2">{school.name}</h1>
                <div className="flex items-center gap-4 text-white/90">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-5 w-5" />
                    <span>{school.city}, {school.provinceState}</span>
                  </div>
                  {school.country && <span className="text-white/60">•</span>}
                  {school.country && <span>{school.country}</span>}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white/20 border-white/40 hover:bg-white/30 text-white"
                  onClick={handleAddToShortlist}
                >
                  <Heart className={`h-5 w-5 ${isShortlisted ? 'fill-white' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white/20 border-white/40 hover:bg-white/30 text-white"
                  onClick={handleShare}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Info Bar */}
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {school.gradesServed && (
              <div>
                <p className="text-sm text-slate-600 font-semibold">GRADES</p>
                <p className="text-lg text-slate-900 font-bold mt-1">{school.gradesServed}</p>
              </div>
            )}
            {school.genderPolicy && (
              <div>
                <p className="text-sm text-slate-600 font-semibold">GENDER POLICY</p>
                <p className="text-lg text-slate-900 font-bold mt-1">{school.genderPolicy}</p>
              </div>
            )}
            {school.curriculumType && (
              <div>
                <p className="text-sm text-slate-600 font-semibold">CURRICULUM</p>
                <p className="text-lg text-slate-900 font-bold mt-1">{school.curriculumType}</p>
              </div>
            )}
            {school.tuition && (
              <div>
                <p className="text-sm text-slate-600 font-semibold">TUITION</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg text-teal-600 font-bold">${school.tuition.toLocaleString()}</p>
                  {school.financialAidAvailable && (
                    <Badge className="bg-green-100 text-green-700">Financial Aid</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Campus Feel Tags */}
            {school.campusFeel && (
              <div className="bg-slate-50 rounded-lg p-6">
                <p className="text-sm font-semibold text-slate-600 mb-3">CAMPUS FEEL</p>
                <Badge className="bg-blue-100 text-blue-700">{school.campusFeel}</Badge>
              </div>
            )}

            <Tabs defaultValue="about" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="academics">Academics</TabsTrigger>
                <TabsTrigger value="programs">Programs</TabsTrigger>
                <TabsTrigger value="admissions">Admissions</TabsTrigger>
                <TabsTrigger value="facilities">Facilities</TabsTrigger>
              </TabsList>

              {/* About Tab */}
              <TabsContent value="about" className="space-y-6">
                {school.missionStatement && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Mission Statement</h3>
                    <p className="text-slate-700 leading-relaxed">{school.missionStatement}</p>
                  </div>
                )}

                {school.teachingPhilosophy && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Teaching Philosophy</h3>
                    <p className="text-slate-700 leading-relaxed">{school.teachingPhilosophy}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  {school.founded && (
                    <div>
                      <p className="text-sm text-slate-600 font-semibold mb-1">FOUNDED</p>
                      <p className="text-2xl font-bold text-slate-900">{school.founded}</p>
                    </div>
                  )}
                  {school.enrollment && (
                    <div>
                      <p className="text-sm text-slate-600 font-semibold mb-1">ENROLLMENT</p>
                      <p className="text-2xl font-bold text-slate-900">{school.enrollment.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {school.values && school.values.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">School Values</h3>
                    <div className="flex flex-wrap gap-2">
                      {school.values.map((value, idx) => (
                        <Badge key={idx} variant="outline">{value}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Academics Tab */}
              <TabsContent value="academics" className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {school.avgClassSize && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 font-semibold mb-1">AVERAGE CLASS SIZE</p>
                      <p className="text-2xl font-bold text-slate-900">{school.avgClassSize}</p>
                    </div>
                  )}
                  {school.studentTeacherRatio && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 font-semibold mb-1">STUDENT-TEACHER RATIO</p>
                      <p className="text-2xl font-bold text-slate-900">{school.studentTeacherRatio}</p>
                    </div>
                  )}
                </div>

                {school.languages && school.languages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Languages Offered</h3>
                    <div className="flex flex-wrap gap-2">
                      {school.languages.map((lang, idx) => (
                        <Badge key={idx} className="bg-purple-100 text-purple-700">{lang}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {school.specialEdPrograms && school.specialEdPrograms.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Special Education Programs</h3>
                    <div className="space-y-2">
                      {school.specialEdPrograms.map((prog, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                          <ChevronRight className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span>{prog}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Programs Tab */}
              <TabsContent value="programs" className="space-y-6">
                {school.artsPrograms && school.artsPrograms.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Arts Programs</h3>
                    <div className="flex flex-wrap gap-2">
                      {school.artsPrograms.map((prog, idx) => (
                        <Badge key={idx} className="bg-pink-100 text-pink-700">{prog}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {school.sportsPrograms && school.sportsPrograms.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Sports Programs</h3>
                    <div className="flex flex-wrap gap-2">
                      {school.sportsPrograms.map((sport, idx) => (
                        <Badge key={idx} className="bg-orange-100 text-orange-700">{sport}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {school.clubs && school.clubs.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Clubs & Organizations</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {school.clubs.map((club, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                          <ChevronRight className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span>{club}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Admissions Tab */}
              <TabsContent value="admissions" className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {school.acceptanceRate && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 font-semibold mb-1">ACCEPTANCE RATE</p>
                      <p className="text-2xl font-bold text-slate-900">{school.acceptanceRate}%</p>
                    </div>
                  )}
                  {school.applicationDeadline && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-sm text-slate-600 font-semibold mb-1">APPLICATION DEADLINE</p>
                      <p className="text-lg font-bold text-slate-900">{school.applicationDeadline}</p>
                    </div>
                  )}
                </div>

                {school.entranceRequirements && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Entrance Requirements</h3>
                    <p className="text-slate-700 leading-relaxed">{school.entranceRequirements}</p>
                  </div>
                )}

                {school.openHouseDates && school.openHouseDates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Open House Dates</h3>
                    <div className="space-y-2">
                      {school.openHouseDates.map((date, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                          <ChevronRight className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span>{date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Facilities Tab */}
              <TabsContent value="facilities" className="space-y-6">
                <div className="space-y-4">
                  {school.boardingAvailable && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <Home className="h-5 w-5 text-teal-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">Boarding Available</p>
                        {school.boardingType && <p className="text-sm text-slate-600">{school.boardingType.charAt(0).toUpperCase() + school.boardingType.slice(1)} boarding</p>}
                      </div>
                    </div>
                  )}

                  {school.beforeAfterCare && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <Zap className="h-5 w-5 text-teal-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">Before/After Care</p>
                        <p className="text-sm text-slate-600">{school.beforeAfterCare}</p>
                      </div>
                    </div>
                  )}

                  {school.transportationOptions && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <MapPinIcon className="h-5 w-5 text-teal-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">Transportation</p>
                        <p className="text-sm text-slate-600">{school.transportationOptions}</p>
                      </div>
                    </div>
                  )}

                  {school.uniformRequired !== undefined && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                      <Award className="h-5 w-5 text-teal-600 flex-shrink-0" />
                      <p className="font-semibold text-slate-900">
                        {school.uniformRequired ? '✓ Uniform Required' : 'No uniform required'}
                      </p>
                    </div>
                  )}
                </div>

                {school.facilities && school.facilities.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Facilities</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {school.facilities.map((facility, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-700">
                          <ChevronRight className="h-4 w-4 text-teal-600 flex-shrink-0" />
                          <span>{facility}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Photos Gallery */}
            {school.photoGallery && school.photoGallery.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Photo Gallery</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {school.photoGallery.slice(0, 6).map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt={`${school.name} photo ${idx + 1}`}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Videos */}
            {school.videos && school.videos.length > 0 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Videos</h3>
                <div className="space-y-4">
                  {school.videos.map((video, idx) => (
                    <a
                      key={idx}
                      href={video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                    >
                      <p className="text-teal-600 font-semibold flex items-center gap-2">
                        Video {idx + 1}
                        <ChevronRight className="h-4 w-4" />
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Card */}
            <Card className="p-6 sticky top-20">
              <h3 className="text-xl font-bold text-slate-900 mb-4">Contact Information</h3>
              <div className="space-y-4 text-sm">
                {school.address && (
                  <div className="flex gap-3">
                    <MapPin className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs font-semibold mb-1">ADDRESS</p>
                      <p className="text-slate-900">{school.address}</p>
                    </div>
                  </div>
                )}
                {school.phone && (
                  <div className="flex gap-3">
                    <Phone className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs font-semibold mb-1">PHONE</p>
                      <a href={`tel:${school.phone}`} className="text-teal-600 hover:underline">{school.phone}</a>
                    </div>
                  </div>
                )}
                {school.email && (
                  <div className="flex gap-3">
                    <Mail className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs font-semibold mb-1">EMAIL</p>
                      <a href={`mailto:${school.email}`} className="text-teal-600 hover:underline break-all">{school.email}</a>
                    </div>
                  </div>
                )}
                {school.website && (
                  <div className="flex gap-3">
                    <Globe className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-slate-600 text-xs font-semibold mb-1">WEBSITE</p>
                      <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline break-all text-xs">{school.website}</a>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* CTA Button */}
            <Link to={createPageUrl('Consultant')}>
              <Button className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-bold py-6 h-auto text-center">
                <Zap className="h-5 w-5 mr-2" />
                Find Out If This School Is Right For Your Child
              </Button>
            </Link>

            {/* Claim School Link */}
            <Button
              variant="outline"
              className="w-full border-2"
              onClick={() => {
                toast.info('Contact us to claim this school profile');
              }}
            >
              Claim This School
            </Button>

            {/* Accreditations */}
            {school.accreditations && school.accreditations.length > 0 && (
              <Card className="p-6">
                <h3 className="font-bold text-slate-900 mb-3">Accreditations</h3>
                <div className="space-y-2">
                  {school.accreditations.map((acc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                      <ChevronRight className="h-4 w-4 text-teal-600 flex-shrink-0" />
                      <span>{acc}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Similar Schools */}
        {similarSchools.length > 0 && (
          <div className="mt-16 pt-12 border-t">
            <h2 className="text-3xl font-bold text-slate-900 mb-8">Similar Schools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarSchools.map(sim => (
                <Link key={sim.id} to={`${createPageUrl('SchoolProfile')}?id=${sim.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden flex flex-col">
                    {sim.heroImage || sim.headerPhotoUrl ? (
                      <img
                        src={sim.heroImage || sim.headerPhotoUrl}
                        alt={sim.name}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="h-40 w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-900 mb-2">{sim.name}</h3>
                      <p className="text-sm text-slate-600 mb-4 flex-1">{sim.city}, {sim.provinceState}</p>
                      <Button variant="outline" size="sm" className="w-full">
                        View Profile
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}