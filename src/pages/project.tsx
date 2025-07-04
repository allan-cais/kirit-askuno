import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabaseService, Project } from '@/lib/supabase';

const colorMap = {
  red: 'bg-red-500',
  orange: 'bg-yellow-500',
  yellow: 'bg-yellow-300',
};

const mockData = {
  decisionQueue: [
    { role: 'EP', label: 'approve permit (blocks call sheet)', time: '17:00', tag: 'PRE' },
    { role: 'Client', label: 'countersign SOW', time: '18:00', tag: 'ADM' },
    { role: 'Director', label: 'lock storyboard', time: '09:00 tomorrow', tag: 'CRE' },
    { role: 'AP', label: 'raise invoice #146', time: '12:00 tomorrow', tag: 'ADM' },
  ],
  adminAlerts: [
    { text: 'W-9 missing', detail: '1st AC  due today' },
    { text: 'Invoice #145', detail: '$25 000  overdue today' },
  ],
  riskLog: [
    { color: 'red', text: 'Weather 70% rain 12 May' },
    { color: 'orange', text: 'Budget trending +12%' },
    { color: 'yellow', text: 'Talent clash 12 May' },
  ],
  commStream: [
    { role: 'Client', item: 'Rough Cut V4', time: '10:42', note: 'Logo must hold 3s' },
    { role: 'Director', item: 'Shot 17B', time: '09:15', note: 'Additional camera setup requested for Shot 17B to provide better coverage' },
  ],
};

interface ProjectDashboardProps {
  projectId: string;
}

const ProjectDashboard = ({ projectId }: ProjectDashboardProps) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const projects = await supabaseService.getProjects();
        const found = projects.find((p) => p.id === projectId);
        setProject(found || null);
      } catch (e) {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };
    if (projectId) fetchProject();
  }, [projectId]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-lg">Loading...</div>;
  }

  if (!project) {
    return <div className="flex-1 flex items-center justify-center text-lg">Project not found.</div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="p-4 flex items-center">
        <div>
          <span className="text-xs font-medium">PROJECT</span>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {project.name}
          </div>
        </div>
      </div>
      <div className="flex-1 p-8 pt-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">SUNNY DAILY DIGEST</h1>
            <div className="w-24 h-px bg-[#4a5565] dark:bg-zinc-700 mx-auto"></div>
            <div className="flex justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span><b>Project:</b> {project.name}</span>
              <span>|</span>
              <span><b>Client:</b> {project.created_by || 'Unknown'}</span>
              <span>|</span>
              <span><b>Budget</b> $0 spent</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">DECISION QUEUE</CardTitle>
                <span className="text-xs text-gray-500">48 hours</span>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockData.decisionQueue.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 uppercase">{item.tag}</Badge>
                      <span className="font-semibold">{item.role}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{item.time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">ADMIN ALERTS</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {mockData.adminAlerts.map((alert, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-semibold">{alert.text}</span>
                      <span className="text-xs text-gray-500">{alert.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">RISK LOG</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {mockData.riskLog.map((risk, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`inline-block w-2 h-2 rounded-full ${colorMap[risk.color as keyof typeof colorMap]}`}></span>
                      <span>{risk.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">COMM STREAM</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mockData.commStream.map((comm, i) => (
                <div key={i} className="flex items-center gap-4 text-sm">
                  <span className="font-semibold min-w-[70px]">{comm.role}</span>
                  <span className="font-mono">•</span>
                  <span className="font-semibold">{comm.item}</span>
                  <span className="text-xs text-gray-500">{comm.time}</span>
                  <span className="text-xs text-gray-500">"{comm.note}"</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard; 