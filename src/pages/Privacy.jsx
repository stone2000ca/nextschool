import Navbar from "@/components/navigation/Navbar";
import Footer from "@/components/navigation/Footer";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Header Banner */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-slate-300">Last Updated: February 20, 2026</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-sm max-w-none">
            {/* 1. WHO WE ARE */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">1. Who We Are</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                NextSchool is operated from Ontario, Canada. We are committed to protecting your privacy and ensuring transparency about how we collect, use, and manage your personal information.
              </p>
              <p className="text-slate-700 leading-relaxed mb-4">
                <strong>Contact:</strong> privacy@nextschool.ca
              </p>
              <p className="text-slate-700 leading-relaxed">
                NextSchool operates in accordance with the <strong>Personal Information Protection and Electronic Documents Act (PIPEDA)</strong>, Canada's federal privacy law that governs how private sector organizations handle personal information.
              </p>
            </div>

            {/* 2. WHAT DATA WE COLLECT - PARENTS */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">2. What Data We Collect — Parents</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                When you use NextSchool, we collect the following information:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3 mb-6">
                <li><strong>Family Profile Information:</strong> Child's name, age/grade, interests, learning needs, learning style, location, budget preferences, school priorities, and dealbreakers</li>
                <li><strong>Account Information:</strong> Your name, email, and password</li>
                <li><strong>Chat History:</strong> Conversations with our AI consultant, including your responses and our recommendations</li>
                <li><strong>Usage Data:</strong> Schools you've shortlisted, notes you've written, comparisons you've made, and pages you've visited</li>
              </ul>
              <p className="text-slate-700 leading-relaxed text-sm bg-amber-50 border border-amber-200 rounded-lg p-4">
                <strong>Important:</strong> We collect information <em>about</em> children as provided by their parent or guardian. Children do not directly create accounts or use the platform.
              </p>
            </div>

            {/* 3. WHAT DATA WE COLLECT - SCHOOLS */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">3. What Data We Collect — Schools</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                When school administrators claim and manage their profiles, we collect:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3">
                <li><strong>Claimant Information:</strong> Full name, role at school, school email, and verification documents (for verification purposes)</li>
                <li><strong>School Profile Data:</strong> Tuition, programs offered, photos, admissions dates, contact information, and other details you provide to display publicly</li>
              </ul>
            </div>

            {/* 4. HOW WE USE DATA */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">4. How We Use Data</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We use your data for these specific purposes:
              </p>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-900 mb-2">Parent Data:</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                    <li>Provide personalized school recommendations</li>
                    <li>Maintain your conversation history</li>
                    <li>Improve our matching algorithms</li>
                    <li>Help you manage your shortlist and notes</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-2">School Data:</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                    <li>Display your school's public profile</li>
                    <li>Support your profile management and updates</li>
                    <li>Process inquiries from parents</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 mb-2">Aggregated/Anonymized Data:</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-2 ml-4">
                    <li>Improve service quality and recommendations</li>
                    <li>Develop new features</li>
                    <li>Generate analytics and insights</li>
                  </ul>
                </div>
              </div>
              <p className="text-slate-700 leading-relaxed mt-6 text-sm bg-teal-50 border border-teal-200 rounded-lg p-4">
                <strong>Critical Privacy Commitment:</strong> Parent family profiles are NEVER shared with schools unless you explicitly initiate contact (such as sending an inquiry).
              </p>
            </div>

            {/* 5. CHILDREN'S DATA */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">5. Children's Data</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We take children's privacy seriously. Here's how we protect it:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3">
                <li>We collect information <em>about</em> children only as provided by their parent or guardian</li>
                <li>Children do not use the platform directly and do not create accounts</li>
                <li>Parents can request access to, correction of, or deletion of their child's information at any time</li>
                <li>We do not sell or share children's personal information with third parties</li>
                <li>For children under 13, we rely on the parent/guardian's consent as the account holder</li>
              </ul>
            </div>

            {/* 6. DATA SHARING AND DISCLOSURE */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">6. Data Sharing and Disclosure</h2>
              <p className="text-slate-700 leading-relaxed mb-6">
                Here's how we handle your data:
              </p>
              <div className="space-y-4">
                <div className="border-l-4 border-teal-600 pl-4">
                  <p className="font-semibold text-slate-900 mb-2">What We Don't Share:</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-2">
                    <li>We do NOT share family data with schools (unless you initiate an inquiry)</li>
                    <li>We do NOT sell personal data to any third party</li>
                  </ul>
                </div>
                <div className="border-l-4 border-amber-600 pl-4">
                  <p className="font-semibold text-slate-900 mb-2">What We May Share:</p>
                  <ul className="list-disc list-inside text-slate-700 space-y-2">
                    <li>Anonymized, aggregated analytics with schools (no personal information included)</li>
                    <li>Data to service providers who process information on our behalf under strict contracts</li>
                    <li>Information if required by law, court order, or government request</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 7. DATA RETENTION */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">7. Data Retention</h2>
              <ul className="list-disc list-inside text-slate-700 space-y-3">
                <li><strong>Account Data:</strong> Retained while your account is active</li>
                <li><strong>Account Deletion:</strong> You can delete your account and all associated data anytime</li>
                <li><strong>Deletion Timeline:</strong> Chat history and family profiles are permanently deleted within 30 days of account deletion</li>
                <li><strong>School Profile Data:</strong> Public school information persists in our database, but admin access is immediately revoked when a school unclaims their profile</li>
              </ul>
            </div>

            {/* 8. COOKIES AND TRACKING */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">8. Cookies and Tracking</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We use cookies to:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3 mb-6">
                <li><strong>Authentication and Session Cookies:</strong> Keep you logged in and secure</li>
                <li><strong>Analytics Cookies:</strong> Understand how you use our platform to improve your experience</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                You can control cookies through your browser settings. Disabling some cookies may affect platform functionality.
              </p>
            </div>

            {/* 9. YOUR RIGHTS UNDER PIPEDA */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">9. Your Rights Under PIPEDA</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                Under PIPEDA, you have the right to:
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3 mb-6">
                <li><strong>Access Your Information:</strong> Request to see what personal data we hold about you</li>
                <li><strong>Request Correction:</strong> Ask us to correct inaccurate or incomplete information</li>
                <li><strong>Withdraw Consent:</strong> Withdraw your consent for us to use your data (though this may limit your use of NextSchool)</li>
                <li><strong>File a Complaint:</strong> Lodge a complaint with the Office of the Privacy Commissioner of Canada if you believe your privacy has been violated</li>
              </ul>
              <p className="text-slate-700 leading-relaxed">
                To exercise any of these rights, contact us at <strong>privacy@nextschool.ca</strong> with your request.
              </p>
            </div>

            {/* 10. CASL COMPLIANCE */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">10. CASL Compliance</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                NextSchool complies with Canada's Anti-Spam Legislation (CASL):
              </p>
              <ul className="list-disc list-inside text-slate-700 space-y-3">
                <li>All commercial emails require your express consent</li>
                <li>All our emails include our sender ID, contact information, and clear instructions on how to unsubscribe</li>
                <li>Unsubscribe requests are honored within 10 business days</li>
              </ul>
            </div>

            {/* 11. CHANGES TO THIS POLICY */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">11. Changes to This Policy</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws.
              </p>
              <p className="text-slate-700 leading-relaxed">
                When we make material changes, we'll notify you by updating the "Last Updated" date and, if significant changes are made, we may notify you by email or through the platform. Your continued use of NextSchool after such changes constitutes your acceptance of the updated Privacy Policy.
              </p>
            </div>

            {/* 12. CONTACT US */}
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">12. Contact Us</h2>
              <p className="text-slate-700 leading-relaxed mb-4">
                If you have questions about this Privacy Policy or how we handle your data, please reach out:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                <p className="text-slate-900 font-semibold mb-2">Email:</p>
                <p className="text-teal-600 mb-6">
                  <a href="mailto:privacy@nextschool.ca" className="hover:underline">privacy@nextschool.ca</a>
                </p>
                <p className="text-slate-900 font-semibold mb-2">Questions or Feedback?</p>
                <Link to={createPageUrl('Contact')} className="text-teal-600 hover:underline">
                  Visit our Contact Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}