import { useState } from 'react';
import { createBetaFeedback } from '@/lib/api/entities-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import Navbar from '@/components/navigation/Navbar';
import Footer from '@/components/navigation/Footer';
import Link from 'next/link';

export default function Feedback() {
  const [formData, setFormData] = useState({
    testerName: '',
    testerEmail: '',
    consultantUsed: '',
    whatWereYouHopingToFind: '',
    didYouFindIt: '',
    whatFrustratedYou: '',
    wouldYouRecommend: '',
    additionalComments: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createBetaFeedback({
        tester_name: formData.testerName,
        tester_email: formData.testerEmail,
        consultant_used: formData.consultantUsed,
        what_were_you_hoping_to_find: formData.whatWereYouHopingToFind,
        did_you_find_it: formData.didYouFindIt,
        what_frustrated_you: formData.whatFrustratedYou,
        would_you_recommend: formData.wouldYouRecommend,
        additional_comments: formData.additionalComments,
        timestamp: new Date().toISOString(),
        source: 'InApp'
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar variant="minimal" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <CheckCircle2 className="h-16 w-16 text-teal-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h2>
            <p className="text-slate-600 mb-8">
              Your feedback is incredibly valuable and helps us build a better experience for parents. We truly appreciate you taking the time to share your thoughts.
            </p>
            <Link href="/">
              <Button className="bg-teal-600 hover:bg-teal-700 w-full">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar variant="minimal" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-6">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <Card className="p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 mb-3">Help Shape NextSchool</h1>
              <p className="text-lg text-slate-600">
                Thanks for trying NextSchool! Your feedback helps us build a better experience for parents like you.
              </p>
              <p className="text-sm text-slate-500 mt-2">Takes about 2 minutes</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Your Name</label>
                <Input
                  type="text"
                  placeholder="Sarah Johnson"
                  value={formData.testerName}
                  onChange={(e) => handleChange('testerName', e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Your Email</label>
                <Input
                  type="email"
                  placeholder="sarah@example.com"
                  value={formData.testerEmail}
                  onChange={(e) => handleChange('testerEmail', e.target.value)}
                  required
                />
              </div>

              {/* Consultant Used */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Which consultant did you use?</label>
                <Select value={formData.consultantUsed} onValueChange={(value) => handleChange('consultantUsed', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a consultant..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Jackie">Jackie (Warm & Supportive)</SelectItem>
                    <SelectItem value="Liam">Liam (Direct & Strategic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* What Were You Hoping */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">What were you hoping to find?</label>
                <Textarea
                  placeholder="e.g., A school with strong STEM programs near downtown Toronto..."
                  value={formData.whatWereYouHopingToFind}
                  onChange={(e) => handleChange('whatWereYouHopingToFind', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Did You Find It */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Did you find what you were looking for?</label>
                <Select value={formData.didYouFindIt} onValueChange={(value) => handleChange('didYouFindIt', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes, exactly what I needed</SelectItem>
                    <SelectItem value="Partially">Partially, some useful results</SelectItem>
                    <SelectItem value="No">No, not what I was looking for</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* What Frustrated You */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">What frustrated you, if anything? (Optional)</label>
                <Textarea
                  placeholder="Anything that was confusing, slow, or didn't work well..."
                  value={formData.whatFrustratedYou}
                  onChange={(e) => handleChange('whatFrustratedYou', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Would You Recommend */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Would you recommend NextSchool to other parents?</label>
                <Select value={formData.wouldYouRecommend} onValueChange={(value) => handleChange('wouldYouRecommend', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes, definitely</SelectItem>
                    <SelectItem value="Maybe">Maybe, needs some work</SelectItem>
                    <SelectItem value="No">No, not yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Additional Comments */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Anything else? (Optional)</label>
                <Textarea
                  placeholder="Any other suggestions or comments..."
                  value={formData.additionalComments}
                  onChange={(e) => handleChange('additionalComments', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !formData.testerName || !formData.testerEmail || !formData.didYouFindIt || !formData.wouldYouRecommend}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                Your feedback is completely anonymous and helps us improve NextSchool.
              </p>
            </form>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}