import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, Compass, TrendingUp, Check } from "lucide-react";
import Link from 'next/link';
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";

export default function ForSchools() {
  const tiers = [
    {
      name: "BASIC",
      price: "Free",
      description: "Get started with your profile",
      features: [
        "Profile listing",
        "5 photos",
        "Basic analytics"
      ]
    },
    {
      name: "ENHANCED",
      price: "$99/mo",
      description: "Expand your reach",
      badge: "Coming Soon",
      features: [
        "Everything in Basic",
        "20 photos",
        "Priority placement",
        "Detailed analytics",
        "Verified badge"
      ]
    },
    {
      name: "PREMIUM",
      price: "$249/mo",
      description: "Maximum visibility",
      badge: "Coming Soon",
      features: [
        "Everything in Enhanced",
        "Unlimited media",
        "Parent messaging",
        "Featured placement",
        "Dedicated support"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 sm:py-28 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">
            Families Are Searching for Schools Like Yours
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            Claim your free profile on NextSchool and control how families discover your school.
          </p>
          <Link href="/portal">
            <Button size="lg" className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-7 text-lg">
              Find Your School & Claim Your Profile
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-slate-900 mb-12 text-center">What You Get</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-slate-100">
              <div className="h-14 w-14 bg-teal-100 rounded-lg flex items-center justify-center mb-6">
                <Lock className="h-7 w-7 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Own Your Profile</h3>
              <p className="text-slate-700 leading-relaxed">
                Update your school's photos, programs, admissions dates, and key information. Families see what you want them to see.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-100">
              <div className="h-14 w-14 bg-amber-100 rounded-lg flex items-center justify-center mb-6">
                <Compass className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Get Discovered</h3>
              <p className="text-slate-700 leading-relaxed">
                When our AI consultant matches families to schools, yours will be recommended with a personalized explanation of why it fits.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-100">
              <div className="h-14 w-14 bg-teal-100 rounded-lg flex items-center justify-center mb-6">
                <TrendingUp className="h-7 w-7 text-teal-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Track Engagement</h3>
              <p className="text-slate-700 leading-relaxed">
                See how families interact with your profile — views, shortlists, and search appearances. (Enhanced tier)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Membership Tiers */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-slate-900 mb-12 text-center">School Membership Tiers</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {tiers.map((tier, idx) => (
              <div key={idx} className={`rounded-2xl p-8 ${tier.badge ? "bg-white border border-slate-200" : "bg-white border-2 border-teal-600"} relative`}>
                {tier.badge && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg rounded-tr-2xl">
                    {tier.badge}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{tier.name}</h3>
                <p className="text-slate-600 text-sm mb-6">{tier.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                </div>
                <div className="space-y-4">
                  {tier.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex gap-3">
                      <Check className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-r from-teal-50 to-amber-50 border-t border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-6">
            Ready to Claim Your School?
          </h2>
          <p className="text-xl text-slate-700 mb-8">
            Start with a free profile today. Upgrade anytime to unlock more features.
          </p>
          <Link href="/portal">
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-7 text-lg">
              Find Your School & Claim
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}