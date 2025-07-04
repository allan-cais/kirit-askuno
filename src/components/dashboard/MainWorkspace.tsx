import React from 'react';
import { MainWorkspaceProps } from './types';
import StatsGrid from './StatsGrid';
import QuickActions from './QuickActions';
import DataFeed from './DataFeed';
import FeedItemDetail from './FeedItemDetail';
import ProjectDashboard from '@/pages/project';

const MainWorkspace = ({ 
  activeProjectId, 
  activeCenterPanel, 
  setActiveCenterPanel, 
  activeFeedItemId, 
  setActiveFeedItemId 
}: MainWorkspaceProps) => {
  if (activeCenterPanel === 'data') {
    if (activeFeedItemId) {
      return <FeedItemDetail id={activeFeedItemId} onBack={() => setActiveFeedItemId(null)} />;
    }
    return <DataFeed onSelect={setActiveFeedItemId} />;
  }
  
  if (activeProjectId) {
    return <ProjectDashboard projectId={activeProjectId} />;
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Workspace Header */}
      <div className="p-4 flex items-center">
        <div>
          <span className="text-xs font-medium">WORKSPACE</span>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ~/sunny.ai/dashboard
          </div>
        </div>
      </div>
      {/* Content Area */}
      <div className="flex-1 p-8 pt-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Welcome to Workspace</h1>
            <div className="w-24 h-px bg-[#4a5565] dark:bg-zinc-700 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Your intelligent development environment
            </p>
          </div>
          <StatsGrid />
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default MainWorkspace; 