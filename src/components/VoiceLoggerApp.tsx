import React, { ChangeEvent, useState } from 'react';
import { useBabyLogger } from '@/store/BabyLoggerContext';
import { Box, Button, Container, TextField, Typography, Alert, IconButton, Paper, Dialog, DialogTitle, DialogContent } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import BugReportIcon from '@mui/icons-material/BugReport';
import UploadIcon from '@mui/icons-material/Upload';
import SettingsIcon from '@mui/icons-material/Settings';
import { ImportEventsDialog } from './ImportEventsDialog';
import { EventCard } from '@/components/events/EventCard';
import { MultiStepAnalysis } from '@/components/analysis/MultiStepAnalysis';

export function VoiceLoggerApp() {
  const {
    events,
    wakeWord,
    sleepWord,
    apiKey,
    isListening,
    voiceStatus,
    error,
    micPermissionDenied,
    utterances,
    setWakeWord,
    setSleepWord,
    setApiKey,
    clearEvents,
    deleteEvent,
    setIsListening,
    clearUtterances,
    debugSetWakeState,
    debugSimulateUtterance,
  } = useBabyLogger();

  const [showDebug, setShowDebug] = useState(false);
  const [debugUtterance, setDebugUtterance] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

    return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      {/* Header */}
      <Paper elevation={1} sx={{ mb: 2, borderRadius: 1 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          p: 1,
        }}>
          <Typography variant="h6" sx={{ fontWeight: 500, flexGrow: 1, m: 0 }}>
            Baby Logger
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <div className="flex items-center gap-1">
                    <button
                onClick={() => setIsListening(!isListening)}
                className={`p-2 rounded-full transition-colors ${
                  micPermissionDenied
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isListening
                      ? voiceStatus.isAwake
                        ? 'bg-red-100 hover:bg-red-200 text-red-600'
                        : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-600'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                }`}
                title={
                  micPermissionDenied
                    ? 'Microphone access needed'
                    : isListening
                      ? voiceStatus.isAwake
                        ? 'Active - Click to stop recording'
                        : 'Sleeping - Waiting for wake word'
                      : 'Microphone off - Click to start'
                }
                disabled={micPermissionDenied}
              >
                {micPermissionDenied ? (
                  <MicOffIcon className="w-5 h-5" />
                ) : isListening ? (
                  voiceStatus.isAwake ? (
                    <MicIcon className="w-5 h-5 animate-pulse" />
                  ) : (
                    <MicIcon className="w-5 h-5" />
                  )
                ) : (
                  <MicOffIcon className="w-5 h-5" />
                )}
                    </button>
              <div className="text-xs font-medium">
                {micPermissionDenied ? (
                  <span className="text-gray-400">No access</span>
                ) : isListening ? (
                  voiceStatus.isAwake ? (
                    <span className="text-red-600">Recording...</span>
                  ) : (
                    <span className="text-yellow-600">Sleeping</span>
                  )
                ) : (
                  <span className="text-gray-500">Mic off</span>
                )}
                </div>
            </div>
            <IconButton
              size="small"
              onClick={() => setImportDialogOpen(true)}
              color="primary"
            >
              <UploadIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
        {(error || micPermissionDenied || (isListening && !voiceStatus.isAwake)) && (
          <Box sx={{ p: 1, pt: 0 }}>
            {error && !error.includes('no-speech') && (
              <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>
            )}
            {micPermissionDenied && (
              <Alert severity="warning" sx={{ mb: 1 }}>Microphone access needed</Alert>
            )}
            {isListening && !voiceStatus.isAwake && (
              <Alert severity="info" sx={{ mb: 0 }}>
                Say "{wakeWord}" to start
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label="OpenAI API Key"
              value={apiKey}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              fullWidth
              type="password"
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Wake Word"
                value={wakeWord}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setWakeWord(e.target.value)}
                size="small"
                fullWidth
              />
              <TextField
                label="Sleep Word"
                value={sleepWord}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSleepWord(e.target.value)}
                size="small"
                fullWidth
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="outlined" onClick={clearEvents}>Clear Events</Button>
              <Button size="small" variant="outlined" onClick={clearUtterances}>Clear Utterances</Button>
              <Button size="small" variant="outlined" color="warning" onClick={() => setShowDebug(!showDebug)}>
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </Button>
            </Box>
            
            {showDebug && (
              <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <Button size="small" variant="outlined" color="warning" onClick={() => debugSetWakeState(true)}>
                    Force Wake
                  </Button>
                  <Button size="small" variant="outlined" color="warning" onClick={() => debugSetWakeState(false)}>
                    Force Sleep
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label="Debug Utterance"
                    value={debugUtterance}
                    onChange={(e) => setDebugUtterance(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      if (debugUtterance.trim()) {
                        debugSimulateUtterance(debugUtterance.trim());
                        setDebugUtterance('');
                      }
                    }}
                  >
                    Send
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <ImportEventsDialog 
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />

      {/* Events List */}
      {events.length > 0 && (
        <>
                {events.map((event) => (
                    <EventCard
                        key={event.id}
                        event={event}
              onDelete={() => deleteEvent(event.id!)}
                    />
                ))}
          <Box sx={{ mt: 2 }}>
            <MultiStepAnalysis events={events} apiKey={apiKey} />
          </Box>
        </>
      )}
    </Container>
  );
} 