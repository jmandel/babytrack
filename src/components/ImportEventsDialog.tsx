import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Alert, Button, Box, Tabs, Tab } from '@mui/material';
import { useBabyLogger } from '@/store/BabyLoggerContext';
import { 
  NewbornEvent, 
  EventType, 
  FeedingType,
  BottleContent,
  BottleContentType,
  BreastSide
} from '@/types/newbornTracker';

// Helper to generate a stable hash from event content
function generateEventHash(event: Omit<NewbornEvent, 'id'>): string {
  const stableJson = JSON.stringify(event, Object.keys(event).sort());
  let hash = 0;
  for (let i = 0; i < stableJson.length; i++) {
    const char = stableJson.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `synthetic_${Math.abs(hash).toString(16)}`;
}

function parseHuckleberryCSV(csvContent: string): NewbornEvent[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty or invalid');
  
  const headers = lines[0].toLowerCase().split(',');
  const events: NewbornEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx]]));

    try {
      const startTime = new Date(row.start);
      const endTime = row.end ? new Date(row.end) : undefined;
      
      let event: Partial<NewbornEvent> | null = null;

      switch (row.activity.toLowerCase()) {
        case 'feed':
          if (row.type?.toLowerCase()?.includes('bottle')) {
            event = {
              eventType: EventType.Feeding,
              occurredAt: startTime.toISOString(),
              endedAt: endTime?.toISOString(),
              subType: FeedingType.Bottle,
              details: {
                contents: [{
                  type: BottleContentType.Formula,
                  amountMl: row.amount ? parseFloat(row.amount) : 0
                }],
                amountMlOffered: row.amount ? parseFloat(row.amount) : 0,
                amountMlConsumed: row.amount ? parseFloat(row.amount) : 0
              }
            };
          } else {
            const durationMinutes = endTime 
              ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
              : 0;
            
            event = {
              eventType: EventType.Feeding,
              occurredAt: startTime.toISOString(),
              endedAt: endTime?.toISOString(),
              subType: FeedingType.Nursing,
              details: {
                attempts: [{
                  side: row.side?.toUpperCase() === 'LEFT' ? BreastSide.Left : BreastSide.Right,
                  durationMinutes
                }]
              }
            };
          }
          break;

        case 'diaper':
          event = {
            eventType: EventType.Diaper,
            occurredAt: startTime.toISOString(),
            details: {
              urine: row.type?.toLowerCase()?.includes('wet') ? { volume: 'medium' } : undefined,
              stool: row.type?.toLowerCase()?.includes('dirty') ? { 
                volume: 'medium',
                color: 'brown'
              } : undefined,
            }
          };
          break;

        case 'sleep':
          event = {
            eventType: EventType.Sleep,
            occurredAt: startTime.toISOString(),
            endedAt: endTime?.toISOString(),
            details: {}
          };
          break;
      }

      if (event) {
        const eventWithoutId = event as Omit<NewbornEvent, 'id'>;
        events.push({
          ...eventWithoutId,
          id: generateEventHash(eventWithoutId)
        } as NewbornEvent);
      }
    } catch (err) {
      console.warn('Failed to parse row:', row, err);
    }
  }

  return events;
}

export function ImportEventsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addEvent } = useBabyLogger();
  const [error, setError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'json' | 'huckleberry'>('json');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      let events: NewbornEvent[];

      if (importType === 'json') {
        events = JSON.parse(content) as NewbornEvent[];
        if (!Array.isArray(events)) {
          throw new Error('File must contain an array of events');
        }
      } else {
        events = parseHuckleberryCSV(content);
      }

      events.forEach(event => {
        const eventWithoutId = { ...event };
        delete eventWithoutId.id;
        const eventToAdd = {
          ...event,
          id: event.id || generateEventHash(eventWithoutId)
        };
        addEvent(eventToAdd);
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Events</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Tabs
            value={importType}
            onChange={(_, newValue) => setImportType(newValue)}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Native JSON" value="json" />
            <Tab label="Huckleberry CSV" value="huckleberry" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <input
            type="file"
            accept={importType === 'json' ? '.json' : '.csv'}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="event-file-input"
          />
          <label htmlFor="event-file-input">
            <Button variant="contained" component="span">
              Choose {importType === 'json' ? 'JSON' : 'CSV'} File
            </Button>
          </label>

          <Box sx={{ mt: 2, typography: 'body2', color: 'text.secondary' }}>
            {importType === 'json' ? (
              <>
                Upload a JSON file containing an array of events. Example format:
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: '8px', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  marginTop: '8px'
                }}>
{`[
  {
    "eventType": "FEEDING",
    "occurredAt": "2024-02-20T15:30:00Z",
    "details": { ... }
  }
]`}
                </pre>
              </>
            ) : (
              <>
                Upload a CSV file exported from the Huckleberry app. The importer will convert:
                <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '20px' }}>
                  <li>Feeds (bottle and nursing)</li>
                  <li>Diapers (wet and dirty)</li>
                  <li>Sleep sessions</li>
                </ul>
              </>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
} 