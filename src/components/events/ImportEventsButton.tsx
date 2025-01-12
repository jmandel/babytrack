import React, { useRef, useState } from 'react';
import { format } from 'date-fns-tz';
import { NewbornEvent } from '@/types/newbornTracker';

interface ImportEventsButtonProps {
  onImport: (events: NewbornEvent[]) => void;
}

export function ImportEventsButton({ onImport }: ImportEventsButtonProps) {
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const events = JSON.parse(e.target?.result as string || '[]');
        if (!Array.isArray(events)) {
          setError('Imported data must be an array of events');
          return;
        }

        // Process each event
        const now = new Date();
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const formatDate = (date: Date) => {
          return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", { timeZone });
        };

        // Enrich events with IDs and metadata if missing
        const enrichedEvents = events.map(eventData => {
          const id = eventData.id || crypto.randomUUID();
          const { id: eventId, meta: oldMeta, ...eventDataWithoutMeta } = eventData;
          
          return {
            ...eventDataWithoutMeta,
            id,
            meta: {
              createdAt: oldMeta?.createdAt || formatDate(now),
              updatedAt: formatDate(now),
              version: 1
            }
          } as NewbornEvent;
        });

        onImport(enrichedEvents);
        
        // Clear the input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        setError('Failed to parse imported events: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg"
      >
        Import Events
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
} 