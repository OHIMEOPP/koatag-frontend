import React from 'react';

interface LayoutProps {
      children: React.ReactNode;
    }

    const Layout: React.FC<LayoutProps> = ({ children }) => {
      return (
        <div style={{flexGrow:2}}>
          <main>{children}</main>
        </div>
      );
    };

export default Layout;