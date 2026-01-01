import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';



// Component to Scroll to Top on Route Change
export function ScrollToTop() {

  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // Since this component doesn't render anything, return null
  return null;
};
