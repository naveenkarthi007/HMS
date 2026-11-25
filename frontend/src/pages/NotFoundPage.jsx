import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or you do not have access to it."
        action={
          <Link to="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">
            Go to my dashboard
          </Link>
        }
      />
    </Card>
  );
}
