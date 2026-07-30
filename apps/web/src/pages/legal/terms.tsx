import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-fx-text-main">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-fx-text-dim hover:text-fx-text-main mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-fx-text-dim mb-8">Last updated: February 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-fx-text-dim leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">1. Acceptance</h2>
            <p>
              By creating a FreightX account or using our platform, you agree to these Terms of
              Service. If you do not agree, do not use FreightX.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              2. Platform Description
            </h2>
            <p>
              FreightX is a freight marketplace connecting carriers, freight brokers, and shippers.
              We provide tools for load posting, bidding, booking, document management, and payment
              processing. FreightX is not a freight broker or carrier — we are a technology platform
              facilitating transactions between independent parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and legally authorized to operate in the freight
              industry in your jurisdiction. Carriers must hold valid operating authority. By
              registering, you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">4. User Obligations</h2>
            <p>
              You agree to: provide accurate information, maintain valid credentials and insurance,
              honor accepted loads, comply with all applicable federal and state transportation laws
              (including FMCSA regulations), and treat other users professionally. You are solely
              responsible for the loads you post, bids you submit, and shipments you execute.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">5. Payments</h2>
            <p>
              Subscription fees are billed monthly via Stripe. Freight payments are processed
              through the platform per agreed rates. Quick Pay fees (2%) are disclosed before
              selection. Disputes must be raised within 30 days of transaction. Chargebacks
              initiated outside this process may result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              6. Prohibited Conduct
            </h2>
            <p>
              You may not: post fraudulent loads or falsify credentials, circumvent platform
              payments by transacting off-platform with matched parties, use the platform for
              unlicensed brokerage, harass other users, or attempt to access accounts or data that
              are not yours.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              7. Limitation of Liability
            </h2>
            <p>
              FreightX provides the platform "as is." We are not liable for cargo loss or damage,
              load cancellations, disputes between users, or any indirect, consequential, or
              incidental damages. Our total liability to you shall not exceed the fees you paid to
              FreightX in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">8. Termination</h2>
            <p>
              We may suspend or terminate accounts for violations of these terms, fraudulent
              activity, or non-payment. You may close your account at any time from Settings.
              Termination does not relieve obligations for completed or in-progress loads.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">9. Governing Law</h2>
            <p>
              These terms are governed by the laws of the State of Texas, without regard to conflict
              of law provisions. Disputes shall be resolved by binding arbitration under AAA
              Commercial Rules.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">10. Contact</h2>
            <p>
              Questions? Contact us at <span className="text-fx-text-main">legal@freightx.io</span>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center gap-4 text-xs text-fx-text-dim">
          <Link to="/privacy" className="hover:text-fx-text-main transition-colors">
            Privacy Policy
          </Link>
          <span>·</span>
          <span>© 2026 FreightX. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
