import { Circle, Clock, CheckCircle, SkipForward } from 'lucide-react';

const ICON = {
  pending: <Circle size={16} className="text-gray-300" />,
  in_progress: <Clock size={16} className="text-blue-500 animate-pulse" />,
  completed: <CheckCircle size={16} className="text-green-500" />,
  skipped: <SkipForward size={16} className="text-gray-400" />,
};

const BORDER = {
  completed: 'border-green-200 bg-green-50/50',
  in_progress: 'border-blue-200 bg-blue-50/50',
};

export default function StageChecklist({ stages = [], editable = false, onAction }) {
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.id} className={`flex items-center gap-3 p-3 rounded-xl border ${BORDER[stage.status] || 'border-gray-100 bg-gray-50/30'}`}>
          {ICON[stage.status]}
          <div className="flex-1">
            <span className="text-sm font-bold" style={{ color: stage.color || '#1a1a2e' }}>{stage.stage_name}</span>
            {stage.completed_at && (
              <span className="text-[10px] text-gray-400 mr-2">{new Date(stage.completed_at).toLocaleDateString('ar-EG')}</span>
            )}
          </div>
          {editable && stage.status === 'pending' && (
            <>
              <button onClick={() => onAction?.(stage.id, 'in_progress')}
                className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">بدء</button>
              <button onClick={() => onAction?.(stage.id, 'skipped')}
                className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600">تخطي</button>
            </>
          )}
          {editable && stage.status === 'in_progress' && (
            <button onClick={() => onAction?.(stage.id, 'completed')}
              className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600">إكمال</button>
          )}
        </div>
      ))}
    </div>
  );
}
