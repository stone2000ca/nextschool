import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, CheckCircle2, BarChart3, BookOpen, Zap } from "lucide-react";
import Link from 'next/link';
import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Tell Us About Your Family",
      description: "In a natural conversation, our consultant learns about your child's grade, personality, interests, and learning needs. We'll also understand your location, budget, and what matters most to your family. Takes about 5 minutes.",
      icon: MessageSquare,
      color: "teal"
    },
    {
      number: 2,
      title: "Review Your Brief",
      description: "Before searching, your consultant reflects back everything it heard — your priorities, constraints, and what it read between the lines. You confirm or adjust. This is your family's reference profile.",
      icon: BookOpen,
      color: "amber"
    },
    {
      number: 3,
      title: "Explore Personalized Matches",
      description: "Each recommended school comes with a personalized explanation: why it fits, what the tradeoffs are. Green checkmarks for matches, orange flags for honest tradeoffs. No generic lists.",
      icon: CheckCircle2,
      color: "teal"
    },
    {
      number: 4,
      title: "Compare & Shortlist",
      description: "Compare schools side-by-side on the criteria that matter to you. Save favorites to your shortlist. The consultant remembers everything across sessions.",
      icon: BarChart3,
      color: "amber"
    },
    {
      number: 5,
      title: "Take Action",
      description: "Get help with next steps — tour preparation, application timelines, and questions to ask. Your consultant is with you until you decide. (Coming soon)",
      icon: Zap,
      color: "teal"
    }
  ];

  const getBgColor = (color) => color === "amber" ? "bg-amber-50" : "bg-teal-50";
  const getIconBg = (color) => color === "amber" ? "bg-amber-100" : "bg-teal-100";
  const getIconColor = (color) => color === "amber" ? "text-amber-600" : "text-teal-600";

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 sm:py-28 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">How NextSchool Works</h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Your personal AI education consultant guides you from first question to final decision.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isEven = idx % 2 === 0;
              
              return (
                <div key={step.number} className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-12 items-center`}>
                  <div className="flex-1">
                    <div className={`${getBgColor(step.color)} rounded-2xl p-8 md:p-12`}>
                      <div className={`${getIconBg(step.color)} rounded-lg w-16 h-16 flex items-center justify-center mb-6 inline-block`}>
                        <Icon className={`h-8 w-8 ${getIconColor(step.color)}`} />
                      </div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-4">{step.title}</h2>
                      <p className="text-lg text-slate-700 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-amber-100 flex items-center justify-center mx-auto">
                        <span className="text-4xl font-bold text-teal-600">{step.number}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-r from-teal-50 to-amber-50 border-t border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Ready to Find Your School?
          </h2>
          <p className="text-xl text-slate-700 mb-8">
            Start your free AI consultation today with no signup required.
          </p>
          <Link href="/consultant">
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