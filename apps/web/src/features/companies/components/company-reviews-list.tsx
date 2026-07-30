import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { getRatingsForCompany } from '@/services/ratings.service';
import type { RatingRow } from '@/lib/database.types';

interface CompanyReviewsListProps {
  companyId: string;
}

export function CompanyReviewsList({ companyId }: CompanyReviewsListProps) {
  const [reviews, setReviews] = useState<RatingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRatingsForCompany(companyId)
      .then(setReviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="text-sm text-fx-text-muted">Loading reviews...</div>;

  if (reviews.length === 0) return <div className="text-sm text-fx-text-muted">No reviews yet</div>;

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl p-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < review.overall ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'}`}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-fx-text">{review.overall}/5</span>
            <span className="text-xs text-fx-text-muted ml-auto">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>

          {(review.communication || review.reliability || review.professionalism) && (
            <div className="flex gap-4 text-xs text-fx-text-muted mb-2">
              {review.communication && <span>Communication: {review.communication}/5</span>}
              {review.reliability && <span>Reliability: {review.reliability}/5</span>}
              {review.professionalism && <span>Professionalism: {review.professionalism}/5</span>}
            </div>
          )}

          {review.comment && <p className="text-sm text-fx-text-muted">{review.comment}</p>}
        </div>
      ))}
    </div>
  );
}
