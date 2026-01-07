import React, { useEffect, useRef, useState } from 'react';
import { Paper, Box, Typography, IconButton } from '@mui/material';
import { Pause, PlayArrow, Clear } from '@mui/icons-material';

const LiveLog = ({ events = [] }) => {
  const [paused, setPaused] = useState(false);
  const [lines, setLines] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!events || events.length === 0) return;
    setLines(prev => {
      const next = [...prev, ...events];
      // Keep last 200 lines
      return next.slice(-200);
    });
  }, [events]);

  useEffect(() => {
    if (!paused && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines, paused]);

  return (
    <Paper elevation={1} sx={{ p: 1, height: 320, display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle1" fontWeight="bold">Live Send Log</Typography>
        <Box>
          <IconButton size="small" onClick={() => setPaused(p => !p)} title={paused ? 'Resume' : 'Pause'}>
            {paused ? <PlayArrow /> : <Pause />}
          </IconButton>
          <IconButton size="small" onClick={() => setLines([])} title="Clear">
            <Clear />
          </IconButton>
        </Box>
      </Box>
      <Box ref={containerRef} sx={{ overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, background: '#0f1724', color: '#e6eef8', p: 1, borderRadius: 1, flex: 1 }}>
        {lines.map((l, idx) => (
          <div key={idx} style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>{l}</div>
        ))}
      </Box>
    </Paper>
  );
};

export default LiveLog;