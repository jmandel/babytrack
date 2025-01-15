import React, { useState } from 'react';
import { Box, Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Tooltip } from '@mui/material';
import { VegaLite } from 'react-vega';
import { executeCode } from '@/lib/codeExecutor';
import { NewbornEvent } from '@/types/newbornTracker';
import { useBabyLogger } from '@/store/BabyLoggerContext';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface VizBlockProps {
  code: string;
  events: NewbornEvent[];
  isFromLibrary?: boolean;
  onChatToAdjust?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`viz-tabpanel-${index}`}
      aria-labelledby={`viz-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>{children}</Box>
      )}
    </div>
  );
}

export function VizBlock({ code, events, isFromLibrary = false, onChatToAdjust }: VizBlockProps) {
  const { saveVisualization } = useBabyLogger();
  const [tab, setTab] = useState(0);
  const [spec, setSpec] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [vizName, setVizName] = React.useState('');
  const [copyTooltip, setCopyTooltip] = React.useState('Copy to clipboard');

  // Update width when container size changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    // Initial width
    updateWidth();

    // Update width on resize
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const generateSpec = async () => {
      try {
        const execResult = await executeCode(code, events);
        if (execResult.error) {
          setError(execResult.error);
          return;
        }
        // The code should return a Vega-Lite spec
        if (execResult.returnValue) {
          const baseSpec = execResult.returnValue;
          // Handle different view types differently
          const finalSpec = {
            ...baseSpec,
            // For layered views, set width on each layer
            ...(baseSpec.layer ? {
              layer: baseSpec.layer.map((layer: any) => ({
                ...layer,
                width: width - 32
              }))
            } : {
              // For single views, set width directly
              width: width - 32
            })
          };
          setSpec(finalSpec);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate visualization');
      }
    };
    if (width > 0) {
      generateSpec();
    }
  }, [code, events, width]);

  const handleSave = () => {
    if (vizName.trim()) {
      saveVisualization(vizName.trim(), code);
      setSaveDialogOpen(false);
      setVizName('');
    }
  };

  const handleCopy = async () => {
    let textToCopy = '';
    if (tab === 1) {
      textToCopy = code;
    } else if (tab === 2 && spec) {
      textToCopy = JSON.stringify(spec, null, 2);
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyTooltip('Copied!');
      setTimeout(() => setCopyTooltip('Copy to clipboard'), 2000);
    } catch (err) {
      setCopyTooltip('Failed to copy');
      setTimeout(() => setCopyTooltip('Copy to clipboard'), 2000);
    }
  };

  return (
    <Box ref={containerRef} sx={{ width: '100%', my: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <Tabs 
          value={tab} 
          onChange={(_, newValue) => setTab(newValue)} 
          aria-label="visualization tabs"
          sx={{ flexGrow: 1 }}
        >
          <Tab label="Visualization" />
          <Tab label="Code" />
          <Tab label="Spec" />
        </Tabs>
        {(tab === 1 || tab === 2) && (
          <Tooltip title={copyTooltip}>
            <IconButton 
              size="small" 
              onClick={handleCopy}
              sx={{ mr: 1 }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {!isFromLibrary ? (
          <Button 
            size="small" 
            onClick={() => setSaveDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Save to Library
          </Button>
        ) : (
          <Button 
            size="small" 
            onClick={onChatToAdjust}
            sx={{ mr: 1 }}
          >
            Chat to Adjust
          </Button>
        )}
      </Box>
      
      <TabPanel value={tab} index={0}>
        {error ? (
          <Box sx={{ color: 'error.main', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {error}
          </Box>
        ) : spec ? (
          <Box sx={{ width: '100%', height: '100%', minHeight: 200 }}>
            <VegaLite
              spec={spec}
              actions={{
                export: true,
                source: false,
                compiled: false,
                editor: false
              }}
              renderer="canvas"
              style={{ width: '100%' }}
            />
          </Box>
        ) : null}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Box sx={{ 
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          '& pre': {
            m: 0,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }
        }}>
          <pre>{code}</pre>
        </Box>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Box sx={{ 
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
          '& pre': {
            m: 0,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }
        }}>
          <pre>{spec ? JSON.stringify(spec, null, 2) : 'No spec available'}</pre>
        </Box>
      </TabPanel>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Visualization</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Visualization Name"
            fullWidth
            value={vizName}
            onChange={(e) => setVizName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!vizName.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 