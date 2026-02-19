import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    try {
      const unverifiedSchools = await base44.entities.School.filter({ verified: false });
      setClaims(unverifiedSchools.filter(s => s.adminUserId));
    } catch (error) {
      console.error('Failed to load claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (schoolId) => {
    try {
      await base44.entities.School.update(schoolId, { verified: true });
      setClaims(claims.filter(c => c.id !== schoolId));
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (schoolId) => {
    try {
      await base44.entities.School.update(schoolId, { status: 'archived' });
      setClaims(claims.filter(c => c.id !== schoolId));
    } catch (error) {
      console.error('Failed to reject:', error);
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">School Claims Queue</h2>
        <p className="text-slate-600">Review and approve school verification requests</p>
      </div>

      {claims.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">All caught up!</h3>
          <p className="text-slate-600">No pending school claims to review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <Card key={claim.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{claim.name}</h3>
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div><span className="font-medium">Location:</span> {claim.city}, {claim.region}</div>
                    <div><span className="font-medium">Claimed:</span> {new Date(claim.created_date).toLocaleDateString()}</div>
                    <div><span className="font-medium">Website:</span> {claim.website || 'N/A'}</div>
                    <div><span className="font-medium">Email:</span> {claim.email || 'N/A'}</div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleApprove(claim.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(claim.id)}
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}