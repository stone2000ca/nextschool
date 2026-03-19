import { useState, useEffect } from "react";
import { DisputeRequest, School, SchoolAdmin, User as UserEntity } from '@/lib/entities';
import { CheckCircle2, XCircle, Clock, RefreshCw, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [enriched, setEnriched] = useState([]); // disputes + school name + current owner
  const [loading, setLoading] = useState(true);
  const [actionMap, setActionMap] = useState({});
  const [transferError, setTransferError] = useState(null);

  async function load() {
    setLoading(true);
    const raw = await DisputeRequest.filter({ status: "pending" });
    raw.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    // Enrich with school name + current owner from SchoolAdmin
    const enrichedRows = await Promise.all(raw.map(async (d) => {
      let schoolName = d.school_id;
      let ownerEmail = "—";
      let ownerName = "—";

      try {
        const schools = await School.filter({ id: d.school_id });
        if (schools[0]) schoolName = schools[0].name;
      } catch (_) {}

      try {
        const admins = await SchoolAdmin.filter({ school_id: d.school_id, role: "owner", is_active: true });
        if (admins[0]) {
          ownerEmail = admins[0].user_id || "—";
          // Try to get user email by userId
          const users = await UserEntity.filter({ id: admins[0].user_id });
          if (users[0]) {
            ownerEmail = users[0].email || "—";
            ownerName = users[0].full_name || "—";
          }
        }
      } catch (_) {}

      return { ...d, school_name: schoolName, ownerEmail, ownerName };
    }));

    setEnriched(enrichedRows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function transferOwnership(dispute) {
    setActionMap(m => ({ ...m, [dispute.id]: "transferring" }));
    setTransferError(null);

    // Find requester user account
    const users = await UserEntity.filter({ email: dispute.requester_email });
    if (!users[0]) {
      setTransferError("No user account found for " + dispute.requester_email + ". They must sign up first.");
      setActionMap(m => ({ ...m, [dispute.id]: null }));
      return;
    }
    const newUserId = users[0].id;

    // Save existing owner IDs for rollback
    const existingAdmins = await SchoolAdmin.filter({ school_id: dispute.school_id, role: "owner" });
    const deactivatedOwnerIds = [];

    try {
      // Deactivate existing owner records for this school
      await Promise.all(existingAdmins.map(async a => {
        await SchoolAdmin.update(a.id, { is_active: false });
        deactivatedOwnerIds.push(a.id);
      }));

      // Create new owner SchoolAdmin record
      await SchoolAdmin.create({
        school_id: dispute.school_id,
        user_id: newUserId,
        role: "owner",
        is_active: true,
      });

      // Mark dispute approved
      await DisputeRequest.update(dispute.id, { status: "approved" });

      setEnriched(e => e.filter(x => x.id !== dispute.id));
      setActionMap(m => ({ ...m, [dispute.id]: "done" }));
    } catch (err) {
      // Rollback: re-activate any owners that were deactivated
      await Promise.all(deactivatedOwnerIds.map(id => SchoolAdmin.update(id, { is_active: true })));
      setTransferError("Transfer failed: " + (err.message || "Unknown error") + ". Previous ownership has been restored.");
      setActionMap(m => ({ ...m, [dispute.id]: null }));
    }
  }

  async function reject(dispute) {
    setActionMap(m => ({ ...m, [dispute.id]: "rejecting" }));
    await DisputeRequest.update(dispute.id, { status: "rejected" });
    setEnriched(e => e.filter(x => x.id !== dispute.id));
    setActionMap(m => ({ ...m, [dispute.id]: "done" }));
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin" /> Loading disputes…
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ownership Disputes</h2>
          <p className="text-slate-500 text-sm mt-1">Access requests from users disputing an existing school ownership.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {transferError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{transferError}</span>
          <button onClick={() => setTransferError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {enriched.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
          <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No pending disputes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {enriched.map(d => {
            const busy = actionMap[d.id];
            return (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-base">{d.school_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted {d.created_date ? new Date(d.created_date).toLocaleDateString("en-CA") : "—"}
                    </p>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Requester */}
                      <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-teal-700 mb-1">Requester</p>
                        <p className="text-sm font-medium text-slate-800">{d.requester_name}</p>
                        <p className="text-xs text-slate-500">{d.requester_email}</p>
                        <p className="text-xs text-slate-500">{d.requester_role}</p>
                      </div>
                      {/* Current owner */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">Current Owner</p>
                        <p className="text-sm font-medium text-slate-800">{d.ownerName}</p>
                        <p className="text-xs text-slate-500">{d.ownerEmail}</p>
                      </div>
                    </div>

                    {d.reason && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-xs font-medium text-amber-700 mb-1">Reason for request</p>
                        <p className="text-sm text-slate-700">{d.reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => transferOwnership(d)}
                      className="bg-teal-600 hover:bg-teal-700 text-white gap-1 whitespace-nowrap"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      {busy === "transferring" ? "Transferring…" : "Transfer Ownership"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => reject(d)}
                      className="text-red-600 border-red-200 hover:bg-red-50 gap-1"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {busy === "rejecting" ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}