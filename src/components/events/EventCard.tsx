import React from 'react';
import { NewbornEvent, EventType, FeedingType } from '@/types/newbornTracker';
import { EventIcon } from './EventIcon';
import { format } from 'date-fns-tz';
import { Card, CardContent, CardActions, Typography, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { DiaperEventContent } from './DiaperEventContent';
import { FeedingEventContent } from './FeedingEventContent';
import { PumpingEventContent } from './PumpingEventContent';
import { SleepEventContent } from './SleepEventContent';
import { AwakeEventContent } from './AwakeEventContent';
import { MedicalEventContent } from './MedicalEventContent';
import { GrowthEventContent } from './GrowthEventContent';
import { MilestoneEventContent } from './MilestoneEventContent';

export interface EventCardProps {
  event: NewbornEvent;
  onDelete: () => void;
}

export function EventCard({ event, onDelete }: EventCardProps) {
  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(event, null, 2);
    navigator.clipboard.writeText(jsonStr).catch((err) => console.error('Failed to copy:', err));
  };

  const renderEventContent = () => {
    if (!event.eventType) return <div className="mt-1 text-xs text-gray-500">Unknown event type</div>;

    switch (event.eventType) {
      case EventType.Feeding:
        return <FeedingEventContent event={event} />;
      case EventType.Pumping:
        return <PumpingEventContent event={event} />;
      case EventType.Diaper:
        return <DiaperEventContent event={event} />;
      case EventType.Sleep:
        return <SleepEventContent event={event} />;
      case EventType.Awake:
        return <AwakeEventContent event={event} />;
      case EventType.Medical:
        return <MedicalEventContent event={event} />;
      case EventType.Growth:
        return <GrowthEventContent event={event} />;
      case EventType.Milestone:
        return <MilestoneEventContent event={event} />;
      default:
        return (
          <div className="mt-1 space-y-1">
            <div className="text-xs text-gray-500">
              Unrecognized event type: <span className="font-bold">{event.eventType}</span>
            </div>
            {event.notes && <div className="text-xs italic text-gray-500">{event.notes}</div>}
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-2 text-sm mb-2">
      <div className="flex items-center gap-2 text-gray-600">
        <div className="flex items-center gap-1">
          <EventIcon type={event.eventType} />
          <span className="text-xs font-semibold">{event.eventType}</span>
        </div>
        <span className="font-mono text-xs">
          {formatDateTime(event.occurredAt)}
          {event.endedAt && ` - ${formatDateTime(event.endedAt)}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleCopyJson}
            className="p-1 text-gray-400 hover:text-blue-500 rounded-full hover:bg-blue-50"
            title="Copy JSON"
          >
            <ContentCopyIcon sx={{ fontSize: 16 }} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
            title="Delete event"
          >
            <DeleteIcon sx={{ fontSize: 16 }} />
          </button>
        </div>
      </div>
      {renderEventContent()}
    </div>
  );
} 