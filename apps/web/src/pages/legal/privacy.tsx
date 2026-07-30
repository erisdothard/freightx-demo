import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-fx-text-main">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-fx-text-dim hover:text-fx-text-main mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-fx-text-dim mb-8">Last updated: February 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-fx-text-dim leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide when registering: name, email address, phone
              number, and company details including MC/DOT numbers and broker authority. We also
              collect data generated through your use of the platform — loads posted, bids
              submitted, documents uploaded, and messages sent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              2. How We Use Your Information
            </h2>
            <p>
              We use your information to provide and improve the FreightX platform, process
              payments, verify carrier/broker credentials via FMCSA, send transactional
              notifications, and comply with applicable law. We do not sell your personal
              information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">3. Data Sharing</h2>
            <p>
              We share information with other users as necessary to facilitate freight transactions
              (e.g., carrier contact info shared with brokers on awarded loads). We share with
              service providers including Supabase (database/auth), Stripe (payments), and Sentry
              (error monitoring), each under appropriate data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">4. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Load records,
              documents, and transaction history are retained for 7 years to comply with federal
              motor carrier record-keeping requirements. You may request deletion of personal data
              not subject to legal retention requirements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">5. Security</h2>
            <p>
              We use industry-standard security including TLS encryption in transit, AES-256
              encryption at rest via Supabase, and row-level security policies ensuring users can
              only access their own data. We conduct regular security reviews.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">6. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, delete, or export
              your personal data. California residents have additional rights under CCPA. To
              exercise any rights, contact us at{' '}
              <span className="text-fx-text-main">privacy@freightx.io</span>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">7. Cookies</h2>
            <p>
              We use session cookies for authentication only. We do not use tracking or advertising
              cookies. You can disable cookies in your browser, but this will prevent you from
              logging in.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">
              8. Changes to This Policy
            </h2>
            <p>
              We may update this policy periodically. We will notify you of material changes via
              email or an in-app notice at least 30 days before they take effect.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fx-text-main mb-2">9. Contact</h2>
            <p>
              Questions about this policy? Contact us at{' '}
              <span className="text-fx-text-main">privacy@freightx.io</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
