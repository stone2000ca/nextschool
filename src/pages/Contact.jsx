import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MapPin, Send, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    userType: 'parent',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      // Display success message
      toast.success('Message sent! We\'ll get back to you soon.');
      setFormData({
        name: '',
        email: '',
        userType: 'parent',
        message: ''
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 sm:py-28 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">Get in Touch</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Have a question about NextSchool? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Form */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Name
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    I'm a...
                  </label>
                  <select
                    name="userType"
                    value={formData.userType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="parent">Parent / Family</option>
                    <option value="school">School Administrator</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us what's on your mind..."
                    rows={6}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 resize-none font-sans"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Contact Information</h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="h-12 w-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Email</p>
                    <a href="mailto:hello@nextschool.ca" className="text-teal-600 hover:underline">
                      hello@nextschool.ca
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-12 w-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 mb-1">Location</p>
                    <p className="text-slate-700">Based in Ontario, Canada</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 mt-12">
                  <h3 className="font-semibold text-slate-900 mb-2">Response Time</h3>
                  <p className="text-slate-700">
                    We typically respond to all inquiries within 1 business day. For urgent matters, please email us directly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}