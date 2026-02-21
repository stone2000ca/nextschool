import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThumbsUp, AlertCircle, MessageSquare } from 'lucide-react';
import Navbar from '@/components/navigation/Navbar';

export default function AdminFeedback() {
  const [user, setUser] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    consultant: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Check if admin
      if (userData?.role !== 'admin') {
        setLoading(false);
        return;
      }

      // Load feedback
      const allFeedback = await base44.entities.BetaFeedback.list('-timestamp', 1000);
      setFeedback(allFeedback);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar variant="minimal" />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h1>
            <p className="text-slate-600">Only admin users can view the feedback dashboard.</p>
          </Card>
        </div>
      </div>
    );
  }

  // Filter feedback
  const filteredFeedback = feedback.filter(item => {
    if (filters.consultant !== 'all' && item.consultantUsed !== filters.consultant) {
      return false;
    }
    if (filters.startDate && new Date(item.timestamp) < new Date(filters.startDate)) {
      return false;
    }
    if (filters.endDate && new Date(item.timestamp) > new Date(filters.endDate)) {
      return false;
    }
    return true;
  });

  // Calculate stats
  const recommendationCounts = feedback.reduce((acc, item) => {
    acc[item.wouldYouRecommend] = (acc[item.wouldYouRecommend] || 0) + 1;
    return acc;
  }, {});

  const avgRecommendation = (
    ((recommendationCounts['Yes'] || 0) * 2 + (recommendationCounts['Maybe'] || 0)) /
    feedback.length * 50
  ).toFixed(0) || 0;

  const frustrations = feedback
    .filter(item => item.whatFrustratedYou)
    .map(item => item.whatFrustratedYou)
    .join(' | ')
    .split('|')
    .map(f => f.trim())
    .filter(Boolean)
    .reduce((acc, frustration) => {
      const key = frustration.substring(0, 50);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const topFrustrations = Object.entries(frustrations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar variant="minimal" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Beta Feedback Dashboard</h1>

        {/* Filters */}
        <Card className="p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select value={filters.consultant} onValueChange={(value) => setFilters({ ...filters, consultant: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Consultants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Consultants</SelectItem>
                <SelectItem value="Jackie">Jackie</SelectItem>
                <SelectItem value="Liam">Liam</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              placeholder="Start Date"
            />

            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              placeholder="End Date"
            />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="text-center">
              <p className="text-slate-600 mb-2">Total Feedback</p>
              <p className="text-4xl font-bold text-teal-600">{feedback.length}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <p className="text-slate-600 mb-2">Recommendation Score</p>
              <div className="flex items-center justify-center gap-2">
                <ThumbsUp className="h-6 w-6 text-teal-600" />
                <p className="text-4xl font-bold text-teal-600">{avgRecommendation}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <p className="text-slate-600 mb-2">Found What They Needed</p>
              <p className="text-4xl font-bold text-teal-600">
                {(((feedback.filter(f => f.didYouFindIt === 'Yes').length) / feedback.length * 100) || 0).toFixed(0)}%
              </p>
            </div>
          </Card>
        </div>

        {/* Top Frustrations */}
        {topFrustrations.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Most Common Frustrations
            </h2>
            <div className="space-y-2">
              {topFrustrations.map((frustration, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">{frustration.text}</p>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                    {frustration.count}x
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recent Feedback */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Recent Feedback ({filteredFeedback.length})
          </h2>

          {filteredFeedback.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No feedback yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-slate-600">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Consultant</th>
                    <th className="pb-3 font-medium">Found</th>
                    <th className="pb-3 font-medium">Recommend</th>
                    <th className="pb-3 font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {filteredFeedback.slice(0, 20).map((item) => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 text-xs text-slate-500">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </td>
                      <td className="py-3 font-medium text-slate-900">{item.testerName}</td>
                      <td className="py-3 text-slate-700">{item.consultantUsed}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.didYouFindIt === 'Yes' ? 'bg-green-100 text-green-800' :
                          item.didYouFindIt === 'Partially' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.didYouFindIt}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item.wouldYouRecommend === 'Yes' ? 'bg-green-100 text-green-800' :
                          item.wouldYouRecommend === 'Maybe' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.wouldYouRecommend}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600 truncate max-w-xs">
                        {item.whatFrustratedYou || item.additionalComments || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}