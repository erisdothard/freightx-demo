import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Mail, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { useAuth } from '@/contexts/AuthContext';
import { getNavRole } from '@/shared/lib/utils';

// TODO: replace with real support number when ready
const SUPPORT_PHONE = '+18005551234';
const SUPPORT_PHONE_DISPLAY = '1-800-555-1234';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How do I post a load?',
    answer:
      'To post a load, go to your dashboard and click "Post Load". Fill in the origin, destination, equipment type, and other details. Once submitted, carriers in your network will be notified.',
  },
  {
    question: 'How do I find loads to haul?',
    answer:
      'As a carrier, visit the Loads page to browse available shipments. You can filter by equipment type, location, and date to find loads that match your capabilities.',
  },
  {
    question: 'How does bidding work?',
    answer:
      'When you find a load you want to haul, click "Bid" and enter your offered rate. The shipper will review bids and accept one. You\'ll be notified when your bid is accepted.',
  },
  {
    question: 'How do I track my shipment?',
    answer:
      'Go to the Track section and enter your load number. You can see the current status, milestones, and estimated delivery time.',
  },
  {
    question: 'What documents do I need?',
    answer:
      'Carriers need their MC number, DOT number, and proof of insurance. Shippers may need their broker authority number. Upload these in the Documents section of your profile.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach our support team via the Contact options below, or email us at support@freightx.com. We typically respond within 24 hours.',
  },
  {
    question: 'Can I change my profile information?',
    answer:
      'Yes, go to Profile > Personal Info or Profile > Company Profile to update your details at any time.',
  },
  {
    question: 'How do I get verified?',
    answer:
      'Complete your profile with required documents (MC/DOT number, insurance). Our team will review your information and verify your account within 1-2 business days.',
  },
];

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const role = getNavRole(profile?.role);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader title="Help Center" showBack backAction={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">❓</div>
          <h1 className="text-xl font-bold text-fx-text">How can we help?</h1>
          <p className="text-sm text-fx-text-muted mt-1">Find answers to common questions below</p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-4">
            Frequently Asked Questions
          </h2>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-fx-surface border border-fx-border rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-fx-surface-2 transition-colors"
              >
                <span className="text-sm font-semibold text-fx-text pr-4">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp size={18} className="text-fx-orange shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-fx-text-dim shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-fx-text-muted leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Options */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-fx-text-muted uppercase tracking-widest mb-4">
            Contact Us
          </h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/messages')}
              className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center">
                <MessageCircle size={18} className="text-fx-orange" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-fx-text">Live Chat</p>
                <p className="text-xs text-fx-text-muted">Chat with our team</p>
              </div>
            </button>

            <a
              href="mailto:support@freightx.com"
              className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Mail size={18} className="text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-fx-text">Email Support</p>
                <p className="text-xs text-fx-text-muted">support@freightx.com</p>
              </div>
            </a>

            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Phone size={18} className="text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-fx-text">Phone Support</p>
                <p className="text-xs text-fx-text-muted">{SUPPORT_PHONE_DISPLAY}</p>
              </div>
            </a>
          </div>
        </div>

        {/* Version Info */}
        <p className="text-center text-[10px] text-fx-text-dim">FreightX v0.2.0 · Phase 2</p>
      </div>

      <BottomNav role={role} />
    </div>
  );
}
