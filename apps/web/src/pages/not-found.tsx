import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl mb-6">🛣️</div>
      <h1 className="text-5xl font-extrabold text-fx-orange mb-2">404</h1>
      <p className="text-lg font-bold text-fx-text mb-2">Road ends here</p>
      <p className="text-sm text-fx-text-muted mb-8 max-w-xs">
        This page doesn't exist or has been moved. Let's get you back on the right route.
      </p>
      <Button size="lg" className="rounded-2xl font-bold px-8" onClick={() => navigate('/')}>
        Back to Home
      </Button>
    </div>
  );
}
