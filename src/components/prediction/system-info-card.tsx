'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Zap,
  GitBranch,
  TrendingUp,
  Info,
  CheckCircle,
  Activity
} from 'lucide-react';

interface SystemInfoCardProps {
  data?: {
    frames_used?: number;
    flow_method?: string;
    avg_frame_interval?: number;
    flow_stats?: {
      mean_magnitude: number;
      max_magnitude: number;
      mean_confidence: number;
    };
  } | null;
}

export function SystemInfoCard({ data }: SystemInfoCardProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-500" />
          <CardTitle className="text-lg">Prediction System</CardTitle>
        </div>
        <CardDescription>
          MongoDB integration and advanced optical flow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Current System Stats */}
        {data && (
          <>
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">📊 Current Session:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Frames Used:</span>
                  <div className="font-bold">{data.frames_used || 0}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Flow Method:</span>
                  <div className="font-bold">{data.flow_method || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Frame Interval:</span>
                  <div className="font-bold">
                    {data.avg_frame_interval?.toFixed(1) || '0'} min
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="bg-green-500">Active</Badge>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
