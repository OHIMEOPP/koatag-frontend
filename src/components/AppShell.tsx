import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} />
      <div>
        <Topbar onCollapse={() => setCollapsed((c) => !c)} />
        {children}
        <div className="foot">KOATAG · v3 CINEMATIC · {new Date().getFullYear()}</div>
      </div>
    </div>
  );
};
