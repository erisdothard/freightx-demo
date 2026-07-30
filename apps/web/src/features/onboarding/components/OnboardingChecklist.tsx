import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRole } from '@/lib/database.types';

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

interface Props {
  role: UserRole;
  profileComplete: boolean;
  companyComplete: boolean;
  firstActionDone: boolean; // first load posted (broker/shipper) or first truck posted (carrier)
  onDismiss?: () => void;
}

export function OnboardingChecklist({
  role,
  profileComplete,
  companyComplete,
  firstActionDone,
  onDismiss,
}: Props) {
  const firstActionStep: Step =
    role === 'carrier'
      ? {
          id: 'truck',
          label: 'Post your first truck',
          description: "Let brokers know you're available",
          href: '/carrier/fleet',
          done: firstActionDone,
        }
      : role === 'broker'
        ? {
            id: 'load',
            label: 'Post your first load',
            description: 'Start getting bids from verified carriers',
            href: '/broker/loads',
            done: firstActionDone,
          }
        : {
            id: 'load',
            label: 'Post your first shipment',
            description: 'Get quotes from carriers instantly',
            href: '/shipper/loads',
            done: firstActionDone,
          };

  const steps: Step[] = [
    {
      id: 'profile',
      label: 'Complete your profile',
      description: 'Add your name, phone, and photo',
      href: '/profile',
      done: profileComplete,
    },
    {
      id: 'company',
      label: 'Set up your company',
      description: 'Add MC/DOT number and contact info',
      href: '/profile',
      done: companyComplete,
    },
    firstActionStep,
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <p className="text-sm font-semibold text-fx-text-main">Get started</p>
          <p className="text-xs text-fx-text-dim mt-0.5">
            {doneCount} of {steps.length} complete
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-fx-text-dim hover:text-fx-text-main transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-800">
        <div
          className="h-full bg-fx-orange transition-all duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="divide-y divide-zinc-800">
        {steps.map((step) => (
          <Link
            key={step.id}
            to={step.done ? '#' : step.href}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${step.done ? 'opacity-50 cursor-default' : 'hover:bg-zinc-800/50'}`}
          >
            {step.done ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <Circle size={18} className="text-zinc-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${step.done ? 'line-through text-fx-text-dim' : 'text-fx-text-main'}`}
              >
                {step.label}
              </p>
              {!step.done && <p className="text-xs text-fx-text-dim mt-0.5">{step.description}</p>}
            </div>
            {!step.done && <ChevronRight size={14} className="text-fx-text-dim shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
