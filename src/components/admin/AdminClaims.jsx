import { useState, useEffect } from 'react';
import { invokeFunction } from '@/lib/functions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const enriched = await invokeFunction('adminClaims', {});
      setClaims(enriched);
    } catch (error) {
      console.error('Failed to load claims:', error);
      toast.error('Failed to load claims. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (claim) => {
    setProcessingId(claim.id);
    try {
      await invokeFunction('approveClaim', {
        claimId: claim.id,
        schoolId: claim.school_id,
        userId: claim.claimed_by,
      });
      setClaims(prev => prev.filter(c => c.id !== claim.id));
      toast.success(`Claim approved for ${claim._schoolName}`);
    } catch (error) {
      console.error('Failed to approve claim:', error);
      toast.error('Failed to approve claim. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (claim) => {
    setProcessingId(claim.id);
    try {
      await invokeFunction('rejectClaim', { claimId: claim.id });
      setClaims(prev => prev.filter(c => c.id !== claim.id));
      toast.success(`Claim rejected for ${claim._schoolName}`);
    } catch (error) {
      console.error('Failed to reject claim:', error);
      toast.error('Failed to reject claim. Please try again.');
    } finally {
      setProcessingId(null);
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
        <p className="text-slate-600">Review and approve school claim requests</p>
      </div>

      {claims.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">All caught up!</h3>
          <p className="text-slate-600">No pending claims to review.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const isProcessing = processingId === claim.id;
            return (
              <Card key={claim.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">{claim._schoolName}</h3>
                      <span className="shrink-0 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {claim.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-600">
                      <div><span className="font-medium">Location:</span> {[claim._schoolCity, claim._schoolRegion].filter(Boolean).join(', ') || 'N/A'}</div>
                      <div><span className="font-medium">Claimant:</span> {claim.claimant_name || 'N/A'} — {claim._userEmail}</div>
                      <div><span className="font-medium">Role at school:</span> {claim.claimant_role || 'N/A'}</div>
                      <div><span className="font-medium">Verification:</span> {claim.verification_method || 'N/A'}</div>
                      <div><span className="font-medium">Submitted:</span> {claim.created_at ? new Date(claim.created_at).toLocaleDateString('en-CA') : 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => handleApprove(claim)}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleReject(claim)}
                      disabled={isProcessing}
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
