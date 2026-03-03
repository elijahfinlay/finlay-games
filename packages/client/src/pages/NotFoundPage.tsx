import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/common/Button';
import { useEffect } from 'react';

export function NotFoundPage() {
  useEffect(() => {
    document.title = '404 - Finlay Games';
  }, []);

  return (
    <PageContainer className="justify-center">
      <h1 className="font-pixel text-4xl text-retro-accent mb-4">404</h1>
      <p className="font-pixel text-[10px] text-retro-muted mb-8">PAGE NOT FOUND</p>
      <Link to="/">
        <Button>BACK TO HOME</Button>
      </Link>
    </PageContainer>
  );
}
