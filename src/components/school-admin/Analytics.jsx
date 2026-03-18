import { useState, useEffect } from 'react';
// Analytics data is currently mocked
import { Card } from '@/components/ui/card';
import { Eye, Heart, Mail, TrendingUp } from 'lucide-react';

export default function Analytics({ school }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [school.id]);

  const loadAnalytics = async () => {
    try {
      // Mock analytics data - in production, this would come from tracking
      setAnalytics({
        profileViews: 1247,
        viewsChange: 12,
        shortlistAdds: 89,
        shortlistChange: 8,
        inquiries: 23,
        inquiriesChange: 15,
        engagement: 64,
        viewsData: [
          { date: 'Jan 20', views: 32 },
          { date: 'Jan 21', views: 45 },
          { date: 'Jan 22', views: 38 },
          { date: 'Jan 23', views: 52 },
          { date: 'Jan 24', views: 48 },
          { date: 'Jan 25', views: 61 },
          { date: 'Jan 26', views: 55 }
        ],
        topSearchTerms: [
          { term: 'IB schools Toronto', count: 45 },
          { term: 'boarding schools Ontario', count: 38 },
          { term: 'STEM private school', count: 29 },
          { term: 'French immersion', count: 21 },
          { term: 'special education', count: 18 }
        ]
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
        <p className="text-slate-600">Last 30 days performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Profile Views</span>
            <Eye className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {analytics.profileViews.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span>+{analytics.viewsChange}% from last month</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Shortlist Adds</span>
            <Heart className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {analytics.shortlistAdds}
          </div>
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span>+{analytics.shortlistChange}% from last month</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Inquiries</span>
            <Mail className="h-5 w-5 text-teal-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {analytics.inquiries}
          </div>
          <div className="flex items-center gap-1 text-sm text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span>+{analytics.inquiriesChange}% from last month</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Engagement Score</span>
            <div className="h-5 w-5 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
              {analytics.engagement}
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {analytics.engagement}%
          </div>
          <div className="text-sm text-slate-600">Above average</div>
        </Card>
      </div>

      {/* Views Chart */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Profile Views (Last 7 Days)</h3>
        <div className="h-64 flex items-end justify-between gap-2">
          {analytics.viewsData.map((item, index) => {
            const maxViews = Math.max(...analytics.viewsData.map(d => d.views));
            const height = (item.views / maxViews) * 100;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center">
                  <span className="text-xs text-slate-600 mb-1">{item.views}</span>
                  <div
                    className="w-full bg-teal-500 rounded-t-lg transition-all hover:bg-teal-600"
                    style={{ height: `${height}%`, minHeight: '20px' }}
                  />
                </div>
                <span className="text-xs text-slate-500">{item.date}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Search Terms */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Search Terms</h3>
        <p className="text-sm text-slate-600 mb-4">
          Keywords that surfaced your school in search results
        </p>
        <div className="space-y-3">
          {analytics.topSearchTerms.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 w-6">{index + 1}</span>
                <span className="text-sm text-slate-900">{item.term}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full"
                    style={{ width: `${(item.count / analytics.topSearchTerms[0].count) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-slate-600 w-12 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}