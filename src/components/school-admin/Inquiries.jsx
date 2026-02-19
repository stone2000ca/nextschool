import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function Inquiries({ schoolId }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [responses, setResponses] = useState({});

  useEffect(() => {
    loadInquiries();
  }, [schoolId]);

  const loadInquiries = async () => {
    try {
      const data = await base44.entities.SchoolInquiry.filter({ schoolId });
      setInquiries(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error('Failed to load inquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResponse = async (inquiryId) => {
    const responseText = responses[inquiryId];
    if (!responseText?.trim()) return;

    try {
      await base44.entities.SchoolInquiry.update(inquiryId, {
        response: responseText,
        status: 'responded'
      });
      
      setInquiries(inquiries.map(inq => 
        inq.id === inquiryId 
          ? { ...inq, response: responseText, status: 'responded' }
          : inq
      ));
      
      setResponses({ ...responses, [inquiryId]: '' });
      setExpandedId(null);
    } catch (error) {
      console.error('Failed to send response:', error);
    }
  };

  const handleCloseInquiry = async (inquiryId) => {
    try {
      await base44.entities.SchoolInquiry.update(inquiryId, { status: 'closed' });
      setInquiries(inquiries.map(inq => 
        inq.id === inquiryId ? { ...inq, status: 'closed' } : inq
      ));
    } catch (error) {
      console.error('Failed to close inquiry:', error);
    }
  };

  const statusConfig = {
    pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
    responded: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Responded' },
    closed: { icon: XCircle, color: 'bg-slate-100 text-slate-700', label: 'Closed' }
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
        <h2 className="text-2xl font-bold text-slate-900">Parent Inquiries</h2>
        <p className="text-slate-600">Manage messages from prospective families</p>
      </div>

      {inquiries.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No inquiries yet</h3>
          <p className="text-slate-600">When parents contact your school, their messages will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry) => {
            const status = statusConfig[inquiry.status];
            const Icon = status.icon;
            const isExpanded = expandedId === inquiry.id;

            return (
              <Card key={inquiry.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                  className="w-full p-6 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-900">Parent Inquiry</h3>
                        <Badge className={status.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {new Date(inquiry.created_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-700 line-clamp-2">{inquiry.message}</p>
                </button>

                {isExpanded && (
                  <div className="border-t p-6 bg-slate-50">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Message</h4>
                      <p className="text-slate-900 whitespace-pre-wrap">{inquiry.message}</p>
                    </div>

                    {inquiry.response && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Your Response</h4>
                        <p className="text-slate-900 whitespace-pre-wrap bg-white p-4 rounded-lg border">
                          {inquiry.response}
                        </p>
                      </div>
                    )}

                    {inquiry.status === 'pending' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Write your response
                          </label>
                          <Textarea
                            value={responses[inquiry.id] || ''}
                            onChange={(e) => setResponses({ ...responses, [inquiry.id]: e.target.value })}
                            placeholder="Type your response here..."
                            rows={4}
                            className="bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSendResponse(inquiry.id)}
                            disabled={!responses[inquiry.id]?.trim()}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Response
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleCloseInquiry(inquiry.id)}
                          >
                            Mark as Closed
                          </Button>
                        </div>
                      </div>
                    )}

                    {inquiry.status === 'responded' && (
                      <Button
                        variant="outline"
                        onClick={() => handleCloseInquiry(inquiry.id)}
                      >
                        Mark as Closed
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}