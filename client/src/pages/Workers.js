import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Slider,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { io } from 'socket.io-client';
import axios from 'axios';
import toast from 'react-hot-toast';

const Workers = ({ socket }) => {
  const [workerSettings, setWorkerSettings] = useState({
    numberOfWorkers: 4,
    emailsPerWorker: 50,
    delayBetweenEmails: 5,
    retryAttempts: 3,
    errorHandling: 'skip',
    enableLogging: true
  });

  const [activeWorkers, setActiveWorkers] = useState([]);
  const [workerLogs, setWorkerLogs] = useState([]);
  const [stats, setStats] = useState({
    totalSent: 0,
    totalFailed: 0,
    averageSpeed: 0,
    activeWorkerCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('worker-progress', handleWorkerProgress);
      socket.on('worker-error', handleWorkerError);
      socket.on('campaign-completed', handleCampaignComplete);
    }

    fetchWorkerStatus();

    return () => {
      if (socket) {
        socket.off('worker-progress');
        socket.off('worker-error');
        socket.off('campaign-completed');
      }
    };
  }, [socket]);

  const fetchWorkerStatus = async () => {
    try {
      const response = await axios.get('/api/workers/active');
      setActiveWorkers(response.data.workers || []);
      setStats(prev => ({
        ...prev,
        activeWorkerCount: response.data.count || 0
      }));
    } catch (error) {
      console.error('Failed to fetch worker status:', error);
    }
  };

  const handleWorkerProgress = (data) => {
    setActiveWorkers(prev => {
      const updated = [...prev];
      const index = updated.findIndex(w => w.id === data.workerId);
      if (index !== -1) {
        updated[index] = { ...updated[index], ...data };
      } else {
        updated.push({ id: data.workerId, ...data });
      }
      return updated;
    });

    // Update logs
    setWorkerLogs(prev => [{
      timestamp: new Date(),
      workerId: data.workerId,
      message: `Processed ${data.current}`,
      type: 'info'
    }, ...prev.slice(0, 50)]);
  };

  const handleWorkerError = (data) => {
    setWorkerLogs(prev => [{
      timestamp: new Date(),
      workerId: data.workerId,
      message: `Failed to send to ${data.contact}: ${data.error}`,
      type: 'error'
    }, ...prev.slice(0, 50)]);

    setStats(prev => ({
      ...prev,
      totalFailed: prev.totalFailed + 1
    }));
  };

  const handleCampaignComplete = (data) => {
    toast.success(`Campaign completed: ${data.sent} sent, ${data.failed} failed`);
    setActiveWorkers(prev => prev.filter(w => w.campaignId !== data.campaignId));
  };

  const handleStartWorkers = async () => {
    setLoading(true);
    try {
      // Start workers with current settings
      const response = await axios.post('/api/workers/start', {
        workers: workerSettings.numberOfWorkers,
        emailsPerWorker: workerSettings.emailsPerWorker,
        delayBetweenEmails: workerSettings.delayBetweenEmails,
        retryAttempts: workerSettings.retryAttempts,
        contacts: [] // Contacts would be selected elsewhere
      });

      if (response.data.success) {
        toast.success('Workers started successfully');
        setStartDialogOpen(false);
        socket.emit('join-room', response.data.workerId);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start workers');
    } finally {
      setLoading(false);
    }
  };

  const handleStopWorker = async (workerId) => {
    try {
      await axios.post(`/api/workers/stop/${workerId}`);
      setActiveWorkers(prev => prev.filter(w => w.id !== workerId));
      toast.success('Worker stopped');
    } catch (error) {
      toast.error('Failed to stop worker');
    }
  };

  const handleSettingsChange = (key, value) => {
    setWorkerSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Worker Settings
      </Typography>

      <Grid container spacing={3}>
        {/* Left Panel - Settings */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Configuration
              </Typography>

              <Box mb={3}>
                <Typography gutterBottom>
                  Number of Workers: {workerSettings.numberOfWorkers}
                </Typography>
                <Slider
                  value={workerSettings.numberOfWorkers}
                  onChange={(e, val) => handleSettingsChange('numberOfWorkers', val)}
                  min={1}
                  max={20}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mb={3}>
                <Typography gutterBottom>
                  Emails Per Worker: {workerSettings.emailsPerWorker} Emails
                </Typography>
                <Slider
                  value={workerSettings.emailsPerWorker}
                  onChange={(e, val) => handleSettingsChange('emailsPerWorker', val)}
                  min={1}
                  max={200}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mb={3}>
                <Typography gutterBottom>
                  Delay Between Emails: {workerSettings.delayBetweenEmails} Seconds
                </Typography>
                <Slider
                  value={workerSettings.delayBetweenEmails}
                  onChange={(e, val) => handleSettingsChange('delayBetweenEmails', val)}
                  min={0}
                  max={30}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mb={3}>
                <Typography gutterBottom>
                  Retry Attempts: {workerSettings.retryAttempts}
                </Typography>
                <Slider
                  value={workerSettings.retryAttempts}
                  onChange={(e, val) => handleSettingsChange('retryAttempts', val)}
                  min={0}
                  max={10}
                  marks
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mb={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={workerSettings.enableLogging}
                      onChange={(e) => handleSettingsChange('enableLogging', e.target.checked)}
                    />
                  }
                  label="Enable Detailed Logging"
                />
              </Box>

              <Button
                fullWidth
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={() => setStartDialogOpen(true)}
                disabled={loading}
              >
                Start Workers
              </Button>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card elevation={2} sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Statistics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {stats.totalSent}
                    </Typography>
                    <Typography variant="caption">Total Sent</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="error">
                      {stats.totalFailed}
                    </Typography>
                    <Typography variant="caption">Total Failed</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="success">
                      {stats.averageSpeed}
                    </Typography>
                    <Typography variant="caption">Avg Speed (emails/min)</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4" color="warning">
                      {stats.activeWorkerCount}
                    </Typography>
                    <Typography variant="caption">Active Workers</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Center Panel - Active Workers */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">
                  Active Workers ({activeWorkers.length})
                </Typography>
                <IconButton onClick={fetchWorkerStatus}>
                  <RefreshIcon />
                </IconButton>
              </Box>

              {activeWorkers.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                  <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    No active workers. Start workers to begin sending emails.
                  </Typography>
                </Paper>
              ) : (
                activeWorkers.map((worker, index) => (
                  <Paper key={worker.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography fontWeight="medium">
                        Worker {worker.workerId || index + 1}
                      </Typography>
                      <Chip
                        label={`${worker.progress?.toFixed(1) || 0}%`}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    
                    <LinearProgress 
                      variant="determinate" 
                      value={worker.progress || 0}
                      sx={{ mb: 1, height: 6, borderRadius: 3 }}
                    />
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="textSecondary">
                        {worker.sent || 0} sent • {worker.failed || 0} failed
                      </Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleStopWorker(worker.id)}>
                          <StopIcon />
                        </IconButton>
                        <IconButton size="small">
                          <PauseIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Logs */}
        <Grid item xs={12} md={4}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Worker Logs
              </Typography>
              
              <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                {workerLogs.length === 0 ? (
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    No logs available
                  </Typography>
                ) : (
                  workerLogs.map((log, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 1,
                        mb: 1,
                        borderRadius: 1,
                        bgcolor: log.type === 'error' ? 'error.light' : 'info.light'
                      }}
                    >
                      <Box display="flex" alignItems="center" mb={0.5}>
                        {log.type === 'error' ? (
                          <ErrorIcon sx={{ fontSize: 16, mr: 1, color: 'error.main' }} />
                        ) : (
                          <CheckCircleIcon sx={{ fontSize: 16, mr: 1, color: 'success.main' }} />
                        )}
                        <Typography variant="caption" fontWeight="medium">
                          {log.workerId}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 'auto' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                      <Typography variant="body2">
                        {log.message}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Start Workers Dialog */}
      <Dialog open={startDialogOpen} onClose={() => setStartDialogOpen(false)}>
        <DialogTitle>Start Workers</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Confirm starting {workerSettings.numberOfWorkers} workers with the following settings:
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mt: 2 }}>
            <Typography>• Workers: {workerSettings.numberOfWorkers}</Typography>
            <Typography>• Emails per worker: {workerSettings.emailsPerWorker}</Typography>
            <Typography>• Delay between emails: {workerSettings.delayBetweenEmails}s</Typography>
            <Typography>• Retry attempts: {workerSettings.retryAttempts}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleStartWorkers} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Workers'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Workers;