import React from 'react';
import { Box, Typography, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useBabyLogger } from '@/store/BabyLoggerContext';
import { VizBlock } from './VizBlock';

interface VisualizationLibraryProps {
  onChatToAdjust: (code: string) => void;
}

export function VisualizationLibrary({ onChatToAdjust }: VisualizationLibraryProps) {
  const { savedVisualizations, deleteVisualization, events } = useBabyLogger();
  const [selectedViz, setSelectedViz] = React.useState<string | null>(null);

  const handleChatToAdjust = (code: string) => {
    onChatToAdjust(code);
    setSelectedViz(null); // Return to list view after starting chat
  };

  if (savedVisualizations.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="body2">
          No saved visualizations yet. Click "Save to Library" on any visualization to add it here.
        </Typography>
      </Box>
    );
  }

  const selectedVisualization = savedVisualizations.find(v => v.id === selectedViz);

  return (
    <Box>
      {selectedViz ? (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {selectedVisualization?.name}
            </Typography>
            <VizBlock 
              code={selectedVisualization?.code || ''} 
              events={events}
              isFromLibrary={true}
              onChatToAdjust={() => handleChatToAdjust(selectedVisualization?.code || '')}
            />
          </Box>
          <Button 
            size="small" 
            onClick={() => setSelectedViz(null)}
            sx={{ mb: 2 }}
          >
            Back to List
          </Button>
        </Box>
      ) : (
        <List dense>
          {savedVisualizations.map((viz) => (
            <ListItem 
              key={viz.id}
              component="div"
              sx={{ cursor: 'pointer' }}
              onClick={() => setSelectedViz(viz.id)}
            >
              <ListItemText 
                primary={viz.name}
                secondary={new Date(viz.createdAt).toLocaleString()}
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  aria-label="delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteVisualization(viz.id);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
} 