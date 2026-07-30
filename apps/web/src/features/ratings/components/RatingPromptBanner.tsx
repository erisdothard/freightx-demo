import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { RatingModal } from './RatingModal';
import { hasRatedLoad } from '@/services/ratings.service';
import { useEffect } from 'react';

interface Props {
  loadId: string;
  loadNumber: string;
  raterId: string;
  ratedCompanyId: string;
  ratedCompanyName: string;
}

export function RatingPromptBanner({
  loadId,
  loadNumber,
  raterId,
  ratedCompanyId,
  ratedCompanyName,
}: Props) {
  const [show, setShow] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    hasRatedLoad(loadId, raterId).then(
      (rated) => {
        if (!rated) setShow(true);
      },
      () => undefined,
    );
  }, [loadId, raterId]);

  if (!show) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-amber-400 fill-amber-400 shrink-0" />
          <p className="text-xs text-fx-text-main">
            Rate your experience with <span className="font-semibold">{ratedCompanyName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            Rate Now →
          </button>
          <button
            onClick={() => setShow(false)}
            className="text-fx-text-dim hover:text-fx-text-main"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <RatingModal
          loadId={loadId}
          loadNumber={loadNumber}
          raterId={raterId}
          ratedCompanyId={ratedCompanyId}
          ratedCompanyName={ratedCompanyName}
          onClose={() => setModalOpen(false)}
          onSubmitted={() => setShow(false)}
        />
      )}
    </>
  );
}
