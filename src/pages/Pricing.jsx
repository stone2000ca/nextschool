import { Button } from "@/components/ui/button";
import { ArrowRight, Check, HelpCircle } from "lucide-react";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";

export default function Pricing() {
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqItems = [
    {
      question: "How many schools can I search for free?",
      answer: "The free tier gives you enough for a full consultation including intake, brief, and your first set of recommendations. You'll have access to unlimited school comparisons and the ability to shortlist your favorites."
    },
    {
      question: "Do I need to create an account?",
      answer: "No! You can start a consultation immediately without signing up. If you want to save your progress and access it later, you can create an account at any time."
    },
    {
      question: "How is this different from a school directory?",
      answer: "Directories give you lists. NextSchool gives you a consultant that understands your family's specific needs and explains why each school is a match. We provide personalized reasoning, not just data."
    },
    {
      question: "Is my family's information private?",
      answer: "Absolutely. Your conversation data and family profile are private and never shared with schools without your explicit consent. You control what information is visible to schools at all times."
    }
  ];

  const features = {
    free: [
      "AI education consultant",
      "Personalized match cards",
      "The Brief (family summary)",
      "School comparison tool",
      "Shortlisting & notes",
      "100 free tokens"
    ],
    premium: [
      "Everything in Free",
      "Unlimited conversations",
      "Action plans & deadlines",
      "Tour prep briefs",
      "Draft communications",
      "Priority support"
    ]
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 sm:py-28 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">Simple, Transparent Pricing</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {/* Free Tier */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 relative">
              <h3 className="text-3xl font-bold text-slate-900 mb-2">Free</h3>
              <p className="text-slate-600 mb-6">Get started with everything you need</p>
              <div className="mb-8">
                <span className="text-5xl font-bold text-teal-600">$0</span>
                <span className="text-slate-600 ml-2">/month</span>
              </div>
              <Link to={createPageUrl('Consultant')}>
                <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 mb-8">
                  Start Free Consultation
                </Button>
              </Link>
              <div className="space-y-4">
                {features.free.map((feature, idx) => (
                  <div key={idx} className="flex gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Premium Tier */}
            <div className="bg-gradient-to-br from-teal-50 to-amber-50 rounded-2xl border-2 border-teal-600 p-8 relative">
              <div className="absolute top-0 right-0 bg-teal-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-2xl">
                Coming Soon
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-2">Premium</h3>
              <p className="text-slate-600 mb-6">Everything plus advanced features</p>
              <div className="mb-8">
                <span className="text-5xl font-bold text-slate-900">Coming Soon</span>
              </div>
              <Button className="w-full bg-slate-400 text-white py-6 mb-8 cursor-not-allowed" disabled>
                Coming Soon
              </Button>
              <div className="space-y-4">
                {features.premium.map((feature, idx) => (
                  <div key={idx} className="flex gap-3">
                    <Check className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-slate-900 mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 text-teal-600 flex-shrink-0" />
                    <span className="font-semibold text-slate-900 text-left">{item.question}</span>
                  </div>
                  <span className={`text-2xl text-slate-400 transform transition-transform ${expandedFaq === idx ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>
                {expandedFaq === idx && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <p className="text-slate-700 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-r from-teal-50 to-amber-50 border-t border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-slate-700 mb-8">
            Your free consultation is waiting. No credit card required.
          </p>
          <Link to={createPageUrl('Consultant')}>
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-7 text-lg">
              Start Your Free Consultation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}