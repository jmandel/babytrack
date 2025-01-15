import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Alert, Button, Box, Tabs, Tab } from '@mui/material';
import { useBabyLogger } from '@/store/BabyLoggerContext';
import { 
  NewbornEvent, 
  EventType, 
  FeedingType,
  BottleContent,
  BottleContentType,
  BreastSide,
  MedicalEventType
} from '@/types/newbornTracker';
import { toLocalIso8601 } from '@/lib/dateUtils';

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

/**
 * Parse "hh:mm" => total minutes (integer).
 */
function parseDurationToMinutes(durationStr: string): number | undefined {
  if (!durationStr) return undefined;
  const [hh, mm] = durationStr.split(":").map((s) => parseInt(s, 10));
  return hh * 60 + mm;
}

function parseBottleContentType(str: string): BottleContentType {
  if (!str) return BottleContentType.Formula;
  const lower = str.trim().toLowerCase();
  if (lower.includes("formula")) return BottleContentType.Formula;
  if (lower.includes("breast")) return BottleContentType.BreastMilk;
  if (lower.includes("water")) return BottleContentType.Water;
  if (lower.includes("fortifier")) return BottleContentType.Fortifier;
  return BottleContentType.Formula;
}

function parseVolumeMl(str: string): number {
  if (!str) return 0;
  const match = str.trim().match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

function parseNursingAttempt(condStr: string): { side: BreastSide, durationMinutes: number } | undefined {
  const match = condStr.trim().match(/(\d+):(\d+)([RL])?/i);
  if (!match) {
    return undefined;
  }
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  let sideChar = match[3] || "R";
  sideChar = sideChar.toUpperCase();

  let side = BreastSide.Right;
  if (sideChar === "L") side = BreastSide.Left;

  const durationMinutes = hh * 60 + mm;
  return { side, durationMinutes };
}

/**
 * Parse a "Feed" row to either a BOTTLE or NURSING event.
 */
function parseFeedingRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const endedAt = toLocalIso8601(row[2]);
  const notes = row[7]?.trim() || undefined;

  if (row[5]?.toLowerCase() === "bottle") {
    // Bottle feed
    const contentType = parseBottleContentType(row[4]);
    const volumeMl = parseVolumeMl(row[6]);
    const details = {
      contents: [
        {
          type: contentType,
          amountMl: volumeMl || 0,
        },
      ],
      amountMlOffered: volumeMl || 0,
      amountMlConsumed: volumeMl || 0,
    };
    return {
      eventType: EventType.Feeding,
      subType: FeedingType.Bottle,
      occurredAt,
      endedAt,
      notes,
      details,
    } as NewbornEvent;
  } 
  else if (row[5]?.toLowerCase() === "breast") {
    // Nursing feed
    const attempts = [];
    if (row[4]) {
      const att = parseNursingAttempt(row[4]);
      if (att) attempts.push(att);
    }
    if (row[6]) {
      const att2 = parseNursingAttempt(row[6]);
      if (att2) attempts.push(att2);
    }
    const details = { attempts };
    return {
      eventType: EventType.Feeding,
      subType: FeedingType.Nursing,
      occurredAt,
      endedAt,
      notes,
      details,
    } as NewbornEvent;
  }

  // Fallback to bottle if we can't detect breast vs. bottle
  return {
    eventType: EventType.Feeding,
    subType: FeedingType.Bottle,
    occurredAt,
    endedAt,
    notes,
    details: {
      contents: [],
      amountMlOffered: 0,
    },
  } as NewbornEvent;
}

/**
 * Parse "Pump" row
 */
function parsePumpRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const endedAt = toLocalIso8601(row[2]);
  const notes = row[7]?.trim() || undefined;
  const duration = parseDurationToMinutes(row[3]);
  const volume = parseVolumeMl(row[4]);

  return {
    eventType: EventType.Pumping,
    occurredAt,
    endedAt,
    notes,
    details: {
      side: "BOTH",
      durationMinutes: duration || 0,
      amountMl: volume || 0,
      letdown: false,
      method: "ELECTRIC",
    },
  } as NewbornEvent;
}

interface StoolDetails {
  volume: 'small' | 'medium' | 'large';
  color?: 'brown' | 'black' | 'yellow' | 'green' | 'red' | 'other';
}

interface UrineDetails {
  volume: 'small' | 'medium' | 'large';
}

/**
 * Parse "Diaper" row
 */
function parseDiaperRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const notes = row[7]?.trim() || undefined;
  // Combine columns 4..7
  const allDiaperText = [row[4], row[5], row[6], row[7]]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let urine: UrineDetails | undefined;
  let stool: StoolDetails | undefined;

  if (allDiaperText.includes("pee") || allDiaperText.includes("urine")) {
    urine = { volume: "medium" };
    if (allDiaperText.includes("large")) urine.volume = "large";
    else if (allDiaperText.includes("small")) urine.volume = "small";
  }
  if (allDiaperText.includes("poo") || allDiaperText.includes("stool") || allDiaperText.includes("poop")) {
    stool = { volume: "medium" };
    if (allDiaperText.includes("large")) stool.volume = "large";
    else if (allDiaperText.includes("small")) stool.volume = "small";

    if (allDiaperText.includes("brown")) stool.color = "brown";
    else if (allDiaperText.includes("black")) stool.color = "black";
    else if (allDiaperText.includes("yellow")) stool.color = "yellow";
    else if (allDiaperText.includes("green")) stool.color = "green";
    else if (allDiaperText.includes("red")) stool.color = "red";
  }

  // If "both" is found but not assigned above
  if (allDiaperText.includes("both")) {
    if (!urine) urine = { volume: "medium" };
    if (!stool) stool = { volume: "medium", color: "other" };
  }

  return {
    eventType: EventType.Diaper,
    occurredAt,
    notes,
    details: {
      urine,
      stool,
    },
  } as NewbornEvent;
}

/**
 * Parse "Meds" row => Medical event (subType=MEDICATION).
 */
function parseMedicationRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const notes = row[7]?.trim() || undefined;
  const medicationName = row[5]?.trim() || "Unspecified medication";

  return {
    eventType: EventType.Medical,
    subType: MedicalEventType.Medication,
    occurredAt,
    notes,
    details: {
      medication: medicationName,
      dosageAmount: 1,
      dosageUnit: "units",
      route: "oral",
    },
  } as NewbornEvent;
}

/**
 * Parse "Tummy time" => treat as AWAKE event
 */
function parseTummyTimeRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const endedAt = toLocalIso8601(row[2]);
  const notes = row[7]?.trim() || undefined;

  return {
    eventType: EventType.Awake,
    occurredAt,
    endedAt,
    notes,
    details: {
      activity: "Tummy time",
    },
  } as NewbornEvent;
}

function parseUnknownRow(row: string[]): NewbornEvent {
  const occurredAt = toLocalIso8601(row[1]);
  const endedAt = toLocalIso8601(row[2]);
  const notes = row[7]?.trim() || undefined;
  return {
    eventType: EventType.Awake,
    occurredAt,
    endedAt,
    notes,
    details: {
      activity: row[0] || "Unknown activity"
    },
  } as NewbornEvent;
}

function parseCsvRowToEvent(row: string[]): NewbornEvent {
  const typeStr = row[0]?.trim().toLowerCase();
  let event: NewbornEvent;
  switch (typeStr) {
    case "feed":
      event = parseFeedingRow(row);
      break;
    case "diaper":
      event = parseDiaperRow(row);
      break;
    case "pump":
      event = parsePumpRow(row);
      break;
    case "meds":
      event = parseMedicationRow(row);
      break;
    case "tummy time":
      event = parseTummyTimeRow(row);
      break;
    default:
      event = parseUnknownRow(row);
  }
  return {
    ...event,
    id: generateEventHash(event)
  };
}

/**
 * Parse CSV content, handling:
 * 1. Line splits with \r\n or \n
 * 2. Quoted fields with commas
 * 3. Header row detection
 */
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // If the first line looks like a header, remove it:
  const firstLineLower = lines[0]?.toLowerCase() || "";
  if (
    firstLineLower.includes("type") &&
    firstLineLower.includes("start") &&
    firstLineLower.includes("end") &&
    firstLineLower.includes("duration")
  ) {
    // This is likely the header row => remove it
    lines.shift();
  }

  return lines.map((line) => {
    let current = "";
    let inQuotes = false;
    const fields = [];

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += c;
      }
    }
    fields.push(current);

    // Remove leading/trailing quotes
    return fields.map((f) => f.replace(/^"|"$/g, ""));
  });
}

function parseHuckleberryCSV(csvContent: string): NewbornEvent[] {
  const rows = parseCsv(csvContent);
  return rows.map(parseCsvRowToEvent);
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