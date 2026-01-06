import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Switch,
  Divider,
  Chip,
  LinearProgress,
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
  DialogActions,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  List as ListIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Email as EmailIcon,
  Timeline as TimelineIcon,
  CheckCircle,
  Error,
  Warning,
  AccessTime,
  Group,
  Speed
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';
import toast from 'react-hot-toast';

const Campaign = () => {
  const { 
    contacts, 
    templates, 
    campaigns: existingCampaigns, 
    addCampaign, 
    addEmail,
    stats 
  } = useEmail();
  
  const [activeStep, setActiveStep] = useState(0);
  const [campaignData, setCampaignData] = useState({
    name: '',
    subject: '',
    content: '',
    contactSelection: 'all',
    selectedContacts: [],
    selectedTag: '',
    workers: 4,
    emailsPerWorker: 50,
    delayBetweenEmails: 5,
    retryAttempts: 3,
    smtpStrategy: 'rotation',
    trackingEnabled: true,
    scheduleType: 'immediate',
    scheduledDate: '',
    scheduledTime: ''
  });

  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    // Extract unique tags from contacts
    const uniqueTags = [...new Set(contacts.flatMap(contact => contact.tags || []))];
    setTags(uniqueTags);
    
    // Load existing campaigns
    setActiveCampaigns(existingCampaigns.filter(campaign => campaign.status === 'active'));
  }, [contacts, existingCampaigns]);

  const steps = ['Setup', 'Content', 'Settings', 'Review'];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCampaignData(prev => ({ ...prev, [name]: value }));
  };

  const handleSliderChange = (name) => (e, value) => {
    setCampaignData(prev => ({ ...prev, [name]: value }));
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setCampaignData(prev => ({
      ...prev,
      subject: template.subject || prev.subject,
      content: template.content || prev.content
    }));
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const getSelectedContactsCount = () => {
    switch (campaignData.contactSelection) {
      case 'all':
        return contacts.length;
      case 'selected':
        return campaignData.selectedContacts.length;
      case 'tag':
        return contacts.filter(c => c.tags?.includes(campaignData.selectedTag)).length;
      default:
        return 0;
    }
  };

  const getSelectedContacts = () => {
    switch (campaignData.contactSelection) {
      case 'all':
        return contacts;
      case 'selected':
        return contacts.filter(c => campaignData.selectedContacts.includes(c.id));
      case 'tag':
        return contacts.filter(c => c.tags?.includes(campaignData.selectedTag));
      default:
        return [];
    }
  };

  const handleStartCampaign = async () => {
    if (!campaignData.name || !campaignData.subject || !campaignData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    const contactCount = getSelectedContactsCount();
    if (contactCount === 0) {
      toast.error('No contacts selected for the campaign');
      return;
    }

    setLoading(true);
    try {
      const selectedContacts = getSelectedContacts();
      const totalEmails = contactCount;
      const emailsPerSecond = campaignData.workers * (60 / campaignData.delayBetweenEmails);
      const estimatedTime = totalEmails / emailsPerSecond;
      
      const campaign = {
        id: Date.now(),
        name: campaignData.name,
        subject: campaignData.subject,
        content: campaignData.content,
        contacts: selectedContacts,
        totalContacts: contactCount,
        sent: 0,
        failed: 0,
        progress: 0,
        status: 'active',
        workers: campaignData.workers,
        emailsPerWorker: campaignData.emailsPerWorker,
        delayBetweenEmails: campaignData.delayBetweenEmails,
        retryAttempts: campaignData.retryAttempts,
        smtpStrategy: campaignData.smtpStrategy,
        trackingEnabled: campaignData.trackingEnabled,
        scheduleType: campaignData.scheduleType,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + estimatedTime * 1000).toISOString()
      };

      // Add to campaigns
      addCampaign(campaign);
      
      // Simulate sending process
      toast.loading(`Starting campaign "${campaignData.name}"...`);
      
      setTimeout(() => {
        // Simulate sending emails
        const interval = setInterval(() => {
          setActiveCampaigns(prev => {
            const updated = [...prev];
            const campaignIndex = updated.findIndex(c => c.id === campaign.id);
            
            if (campaignIndex !== -1) {
              const campaignToUpdate = { ...updated[campaignIndex] };
              
              // Simulate sending 1-5 emails per interval
              const emailsToSend = Math.min(
                Math.floor(Math.random() * 5) + 1,
                campaignToUpdate.totalContacts - campaignToUpdate.sent
              );
              
              campaignToUpdate.sent += emailsToSend;
              campaignToUpdate.progress = (campaignToUpdate.sent / campaignToUpdate.totalContacts) * 100;
              
              // Randomly fail some emails
              const failed = Math.floor(Math.random() * 2);
              campaignToUpdate.failed += failed;
              
              // Create sent emails
              for (let i = 0; i < emailsToSend; i++) {
                if (campaignToUpdate.sent - i <= campaignToUpdate.contacts.length) {
                  const contact = campaignToUpdate.contacts[campaignToUpdate.sent - i - 1];
                  if (contact) {
                    const sentEmail = {
                      id: Date.now() + Math.random(),
                      to: [{ email: contact.email, name: `${contact.firstName} ${contact.lastName}` }],
                      subject: campaignToUpdate.subject,
                      body: campaignToUpdate.content.replace('{{first_name}}', contact.firstName)
                                                    .replace('{{last_name}}', contact.lastName)
                                                    .replace('{{email}}', contact.email)
                                                    .replace('{{company}}', contact.company || ''),
                      isHtml: true,
                      fromName: 'Campaign',
                      fromEmail: 'campaign@emailsender.com',
                      trackingEnabled: campaignToUpdate.trackingEnabled,
                      sentAt: new Date().toISOString(),
                      status: i < failed ? 'failed' : 'sent',
                      campaignId: campaignToUpdate.id,
                      recipients: 1
                    };
                    addEmail(sentEmail);
                  }
                }
              }
              
              // Check if campaign is complete
              if (campaignToUpdate.sent >= campaignToUpdate.totalContacts) {
                campaignToUpdate.status = 'completed';
                campaignToUpdate.completedAt = new Date().toISOString();
                clearInterval(interval);
                toast.success(`Campaign "${campaignToUpdate.name}" completed!`);
              }
              
              updated[campaignIndex] = campaignToUpdate;
            }
            
            return updated;
          });
        }, 1000); // Update every second

        // Cleanup after 5 minutes or when campaign completes
        setTimeout(() => {
          clearInterval(interval);
        }, 5 * 60 * 1000);

      }, 2000);

      toast.success(`Campaign "${campaignData.name}" started successfully!`);
      
      // Reset form
      setCampaignData({
        name: '',
        subject: '',
        content: '',
        contactSelection: 'all',
        selectedContacts: [],
        selectedTag: '',
        workers: 4,
        emailsPerWorker: 50,
        delayBetweenEmails: 5,
        retryAttempts: 3,
        smtpStrategy: 'rotation',
        trackingEnabled: true,
        scheduleType: 'immediate',
        scheduledDate: '',
        scheduledTime: ''
      });
      setActiveStep(0);
      setSelectedTemplate(null);
      
    } catch (error) {
      toast.error('Failed to start campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleStopCampaign = (campaignId) => {
    if (window.confirm('Are you sure you want to stop this campaign?')) {
      setActiveCampaigns(prev => prev.map(campaign => 
        campaign.id === campaignId 
          ? { ...campaign, status: 'stopped', stoppedAt: new Date().toISOString() }
          : campaign
      ));
      toast.success('Campaign stopped');
    }
  };

  const handlePauseCampaign = (campaignId) => {
    setActiveCampaigns(prev => prev.map(campaign => 
      campaign.id === campaignId 
        ? { ...campaign, status: campaign.status === 'paused' ? 'active' : 'paused' }
        : campaign
    ));
    toast.success('Campaign paused/resumed');
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Campaign Setup
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Campaign Name *"
                  name="name"
                  value={campaignData.name}
                  onChange={handleInputChange}
                  required
                  helperText="Give your campaign a descriptive name"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography gutterBottom variant="subtitle2">
                  Select Contacts ({getSelectedContactsCount()} contacts)
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={campaignData.contactSelection}
                    onChange={handleInputChange}
                    name="contactSelection"
                  >
                    <MenuItem value="all">All Active Contacts ({contacts.length})</MenuItem>
                    <MenuItem value="selected">Selected Contacts</MenuItem>
                    <MenuItem value="tag">By Tag</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {campaignData.contactSelection === 'tag' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Select Tag</InputLabel>
                    <Select
                      value={campaignData.selectedTag}
                      onChange={handleInputChange}
                      name="selectedTag"
                      label="Select Tag"
                    >
                      {tags.map(tag => (
                        <MenuItem key={tag} value={tag}>
                          {tag} ({contacts.filter(c => c.tags?.includes(tag)).length} contacts)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {campaignData.contactSelection === 'selected' && (
                <Grid item xs={12}>
                  <Typography gutterBottom variant="subtitle2">
                    Select Contacts:
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                    {contacts.map(contact => (
                      <FormControlLabel
                        key={contact.id}
                        control={
                          <Switch
                            checked={campaignData.selectedContacts.includes(contact.id)}
                            onChange={(e) => {
                              const newSelected = e.target.checked
                                ? [...campaignData.selectedContacts, contact.id]
                                : campaignData.selectedContacts.filter(id => id !== contact.id);
                              setCampaignData(prev => ({ ...prev, selectedContacts: newSelected }));
                            }}
                            size="small"
                          />
                        }
                        label={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                              {contact.firstName?.[0]}{contact.lastName?.[0]}
                            </Avatar>
                            <Typography variant="body2">
                              {contact.firstName} {contact.lastName} ({contact.email})
                            </Typography>
                          </Box>
                        }
                      />
                    ))}
                  </Paper>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Email Content
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Subject *"
                  name="subject"
                  value={campaignData.subject}
                  onChange={handleInputChange}
                  required
                  helperText="Email subject line"
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Box sx={{ p: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip
                        label="HTML"
                        color="primary"
                        size="small"
                      />
                      <Box sx={{ ml: 'auto' }}>
                        <Button
                          size="small"
                          startIcon={<ListIcon />}
                          onClick={() => setPreviewOpen(true)}
                        >
                          Preview
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box sx={{ p: 2 }}>
                    <textarea
                      value={campaignData.content}
                      onChange={(e) => setCampaignData(prev => ({ ...prev, content: e.target.value }))}
                      style={{
                        width: '100%',
                        minHeight: '300px',
                        fontFamily: 'monospace',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        fontSize: '14px'
                      }}
                      placeholder="Write your email content here... Use {{first_name}}, {{last_name}}, {{email}}, {{company}} placeholders."
                    />
                  </Box>
                </Box>
              </Grid>

              {templates.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Available Templates:
                  </Typography>
                  <Grid container spacing={2}>
                    {templates.slice(0, 3).map(template => (
                      <Grid item xs={12} md={4} key={template.id}>
                        <Paper
                          variant="outlined"
                          sx={{ 
                            p: 2, 
                            cursor: 'pointer', 
                            '&:hover': { borderColor: 'primary.main' },
                            bgcolor: selectedTemplate?.id === template.id ? 'action.selected' : 'background.paper'
                          }}
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <EmailIcon fontSize="small" color="action" />
                            <Typography fontWeight="medium" noWrap>
                              {template.name}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="textSecondary" noWrap>
                            {template.subject}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Campaign Settings
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom variant="subtitle2">
                  Workers: {campaignData.workers}
                </Typography>
                <Slider
                  value={campaignData.workers}
                  onChange={handleSliderChange('workers')}
                  min={1}
                  max={20}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="textSecondary">
                  Number of parallel sending processes
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography gutterBottom variant="subtitle2">
                  Emails Per Worker: {campaignData.emailsPerWorker}
                </Typography>
                <Slider
                  value={campaignData.emailsPerWorker}
                  onChange={handleSliderChange('emailsPerWorker')}
                  min={1}
                  max={200}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="textSecondary">
                  Maximum emails each worker can send
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography gutterBottom variant="subtitle2">
                  Delay Between Emails: {campaignData.delayBetweenEmails} seconds
                </Typography>
                <Slider
                  value={campaignData.delayBetweenEmails}
                  onChange={handleSliderChange('delayBetweenEmails')}
                  min={0}
                  max={30}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="textSecondary">
                  Time between sending each email
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography gutterBottom variant="subtitle2">
                  Retry Attempts: {campaignData.retryAttempts}
                </Typography>
                <Slider
                  value={campaignData.retryAttempts}
                  onChange={handleSliderChange('retryAttempts')}
                  min={0}
                  max={10}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="textSecondary">
                  Number of retries for failed emails
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>SMTP Strategy</InputLabel>
                  <Select
                    value={campaignData.smtpStrategy}
                    onChange={handleInputChange}
                    name="smtpStrategy"
                    label="SMTP Strategy"
                  >
                    <MenuItem value="rotation">Rotation (One at a time)</MenuItem>
                    <MenuItem value="parallel">Parallel (Multiple simultaneously)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={campaignData.trackingEnabled}
                      onChange={(e) => setCampaignData(prev => ({ ...prev, trackingEnabled: e.target.checked }))}
                    />
                  }
                  label="Enable Email Tracking"
                />
                <Typography variant="caption" color="textSecondary" display="block">
                  Track opens and clicks
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Scheduling
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={campaignData.scheduleType}
                    onChange={handleInputChange}
                    name="scheduleType"
                  >
                    <MenuItem value="immediate">Send Immediately</MenuItem>
                    <MenuItem value="scheduled">Schedule for Later</MenuItem>
                  </Select>
                </FormControl>

                {campaignData.scheduleType === 'scheduled' && (
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Schedule Date"
                        type="date"
                        value={campaignData.scheduledDate}
                        onChange={handleInputChange}
                        name="scheduledDate"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Schedule Time"
                        type="time"
                        value={campaignData.scheduledTime}
                        onChange={handleInputChange}
                        name="scheduledTime"
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                )}
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        const selectedContacts = getSelectedContacts();
        const estimatedTime = selectedContacts.length / (campaignData.workers * (60 / campaignData.delayBetweenEmails));
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Campaign Review
            </Typography>
            <Alert severity="info" sx={{ mb: 3 }}>
              Review your campaign settings before starting
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Campaign Summary
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        Campaign Name:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.name}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        Contacts:
                      </Typography>
                      <Typography fontWeight="medium">{getSelectedContactsCount()} contacts</Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">
                        Subject:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.subject}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="textSecondary">
                        Workers:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.workers}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="textSecondary">
                        Emails/Worker:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.emailsPerWorker}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Typography variant="body2" color="textSecondary">
                        Delay:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.delayBetweenEmails}s</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        Estimated Time:
                      </Typography>
                      <Typography fontWeight="medium">{Math.ceil(estimatedTime)} minutes</Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="textSecondary">
                        Tracking:
                      </Typography>
                      <Typography fontWeight="medium">{campaignData.trackingEnabled ? 'Enabled' : 'Disabled'}</Typography>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Typography variant="body2" color="textSecondary">
                        Schedule:
                      </Typography>
                      <Typography fontWeight="medium">
                        {campaignData.scheduleType === 'immediate' 
                          ? 'Send Immediately' 
                          : `Scheduled for ${campaignData.scheduledDate} ${campaignData.scheduledTime}`}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Box display="flex" justifyContent="space-between">
                  <Button onClick={handleBack}>Back</Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
                    onClick={handleStartCampaign}
                    disabled={loading}
                    size="large"
                  >
                    {loading ? 'Starting...' : campaignData.scheduleType === 'immediate' ? 'Start Campaign' : 'Schedule Campaign'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Campaign Management
      </Typography>

      <Grid container spacing={3}>
        {/* Left Panel - Campaign Creation */}
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardContent>
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {renderStepContent(activeStep)}

              {activeStep < steps.length - 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={
                      (activeStep === 0 && !campaignData.name) ||
                      (activeStep === 1 && (!campaignData.subject || !campaignData.content))
                    }
                  >
                    {activeStep === steps.length - 2 ? 'Review' : 'Next'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Panel - Active Campaigns */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">
                  Active Campaigns ({activeCampaigns.filter(c => c.status === 'active').length})
                </Typography>
                <IconButton onClick={() => setActiveCampaigns([...activeCampaigns])} size="small">
                  <RefreshIcon />
                </IconButton>
              </Box>

              {activeCampaigns.filter(c => c.status === 'active').length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <TimelineIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="textSecondary">
                    No active campaigns
                  </Typography>
                </Paper>
              ) : (
                activeCampaigns
                  .filter(campaign => campaign.status === 'active')
                  .map(campaign => (
                    <Paper key={campaign.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography fontWeight="medium" noWrap>
                          {campaign.name}
                        </Typography>
                        <Chip
                          label={`${campaign.progress?.toFixed(1) || 0}%`}
                          size="small"
                          color="primary"
                        />
                      </Box>
                      
                      <LinearProgress 
                        variant="determinate" 
                        value={campaign.progress || 0}
                        sx={{ mb: 1, height: 6, borderRadius: 3 }}
                      />
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="caption" color="textSecondary">
                          {campaign.sent || 0}/{campaign.totalContacts} sent
                        </Typography>
                        <Typography variant="caption" color="error">
                          {campaign.failed || 0} failed
                        </Typography>
                      </Box>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Group fontSize="small" color="action" />
                          <Typography variant="caption" color="textSecondary">
                            {campaign.workers} workers
                          </Typography>
                        </Box>
                        <Box>
                          <Tooltip title={campaign.status === 'paused' ? 'Resume' : 'Pause'}>
                            <IconButton 
                              size="small" 
                              onClick={() => handlePauseCampaign(campaign.id)}
                            >
                              {campaign.status === 'paused' ? <PlayIcon /> : <PauseIcon />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Stop Campaign">
                            <IconButton 
                              size="small" 
                              onClick={() => handleStopCampaign(campaign.id)}
                            >
                              <StopIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Paper>
                  ))
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Subject: {campaignData.subject}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box
              dangerouslySetInnerHTML={{ 
                __html: campaignData.content || '<p style="color: #666; font-style: italic;">No content</p>'
              }}
              sx={{ minHeight: 300 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Campaign;