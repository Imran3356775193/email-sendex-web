import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Checkbox,
  MenuItem,
  FormControlLabel,
  Switch,
  Select,
  InputLabel,
  FormControl,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Preview,
  Upload,
  Code,
  TextFields,
  Search as SearchIcon,
  Person as PersonIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useEmail } from '../context/EmailContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Compose = () => {
  const { user } = useAuth();
  const { 
    contacts, 
    templates, 
    smtpSettings, 
    addEmail,
    getActiveSmtpAccounts,
    getDefaultSmtp
  } = useEmail();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSmtp, setSelectedSmtp] = useState(null);
  const [selectedSmtps, setSelectedSmtps] = useState([]);
  const [useMultipleSmtp, setUseMultipleSmtp] = useState(false);
  const [campaignRequired, setCampaignRequired] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [emailData, setEmailData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    htmlBody: '',
    isHtml: true,
    fromName: '',
    fromEmail: '',
    templateId: '',
    trackingEnabled: true,
    smtpStrategy: 'rotation',
    smtpId: ''
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const fileInputRef = useRef(null);
  const htmlInputRef = useRef(null);

  const activeSmtpAccounts = getActiveSmtpAccounts();
  
  // Initialize with default SMTP
  useEffect(() => {
    if (activeSmtpAccounts.length > 0 && !selectedSmtp) {
      const defaultSmtp = getDefaultSmtp();
      setSelectedSmtp(defaultSmtp);
      setEmailData(prev => ({
        ...prev,
        smtpId: defaultSmtp.id,
        fromEmail: defaultSmtp.username,
        fromName: defaultSmtp.displayName || defaultSmtp.username.split('@')[0]
      }));
    } else if (activeSmtpAccounts.length === 0) {
      // Fallback to user email if no SMTP configured
      setEmailData(prev => ({
        ...prev,
        fromEmail: user?.email || 'noreply@example.com',
        fromName: user?.name || 'Email Sender'
      }));
    }
  }, [activeSmtpAccounts, user]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const newAttachments = acceptedFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`Added ${acceptedFiles.length} attachment(s)`);
    },
    maxSize: 10485760 // 10MB
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmailData(prev => ({ ...prev, [name]: value }));
    
    // Update selected SMTP if changed
    if (name === 'smtpId') {
      const smtp = activeSmtpAccounts.find(s => s.id === value);
      if (smtp) {
        setSelectedSmtp(smtp);
        setEmailData(prev => ({
          ...prev,
          fromEmail: smtp.username,
          fromName: smtp.displayName || prev.fromName || smtp.username.split('@')[0]
        }));
      }
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setEmailData(prev => ({
      ...prev,
      subject: template.subject || prev.subject,
      body: template.content || prev.body,
      htmlBody: template.content || prev.htmlBody,
      templateId: template.id
    }));
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleHTMLImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEmailData(prev => ({
          ...prev,
          htmlBody: event.target.result,
          isHtml: true
        }));
        toast.success('HTML file imported successfully');
      };
      reader.readAsText(file);
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
    toast.success('Attachment removed');
  };

  const handleContactSelect = (contact) => {
    setSelectedContacts(prev => {
      if (prev.find(c => c.id === contact.id)) return prev;
      const next = [...prev, contact];
      // update recipient field immediately with new list
      const emails = next.map(c => c.email).join(', ');
      setEmailData(ed => ({ ...ed, to: emails }));
      return next;
    });
  };

  const handleRemoveContact = (contactId) => {
    setSelectedContacts(prev => {
      const next = prev.filter(c => c.id !== contactId);
      const emails = next.map(c => c.email).join(', ');
      setEmailData(ed => ({ ...ed, to: emails }));
      return next;
    });
  };

  const updateRecipientField = () => {
    const emails = selectedContacts.map(c => c.email).join(', ');
    setEmailData(prev => ({ ...prev, to: emails }));
  };

  const insertPlaceholder = (placeholder) => {
    const textarea = document.getElementById('emailBody');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = emailData.isHtml ? emailData.htmlBody : emailData.body;
      const newText = text.substring(0, start) + placeholder + text.substring(end);
      
      if (emailData.isHtml) {
        setEmailData(prev => ({ ...prev, htmlBody: newText }));
      } else {
        setEmailData(prev => ({ ...prev, body: newText }));
      }
    }
  };

  const handleSendTest = async () => {
    // Validate SMTP selection
    if (!selectedSmtp) {
      toast.error('Please configure and select an SMTP server first');
      navigate('/smtp');
      return;
    }

    if (!emailData.to) {
      toast.error('Please add at least one recipient');
      return;
    }

    if (!emailData.subject || (!emailData.body && !emailData.htmlBody)) {
      toast.error('Please fill in subject and email content');
      return;
    }

    const storedUser = localStorage.getItem('user');
    const token = storedUser ? JSON.parse(storedUser).token : null;

    if (token) {
      // Call server bulk send endpoint with single recipient
      setSending(true);
      try {
        // For test sends use single-send endpoint and include smtpConfig from selected SMTP
        const toString = emailData.to.split(/[,;]/).map(s => s.trim()).filter(Boolean).join(',');
        const payload = {
          to: toString,
          subject: emailData.subject,
          body: emailData.body,
          htmlBody: emailData.htmlBody,
          isHtml: emailData.isHtml,
          fromName: emailData.fromName,
          fromEmail: emailData.fromEmail,
          trackingEnabled: emailData.trackingEnabled,
          smtpConfig: {
            host: selectedSmtp.host || selectedSmtp.hostname || selectedSmtp.server,
            port: selectedSmtp.port || 587,
            secure: selectedSmtp.secure === undefined ? (selectedSmtp.port === 465) : !!selectedSmtp.secure,
            auth: {
              user: selectedSmtp.username || selectedSmtp.user || selectedSmtp.authUser,
              pass: selectedSmtp.password || selectedSmtp.pass || selectedSmtp.authPass
            }
          }
        };

        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Send failed');

        toast.success(json.message || 'Test email sent');
        // Optionally navigate to history or watch job
      } catch (err) {
        toast.error(err.message || 'Failed to send test email');
      } finally {
        setSending(false);
      }

      return;
    }

    // Local demo mode: show informative message and simulate send
    toast('You are in demo mode — no API request made. Authenticate to send real emails.', { icon: 'ℹ️' });
    setSending(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const sentEmail = {
        ...emailData,
        to: emailData.to.split(',').map(email => ({ email: email.trim() })),
        fromEmail: selectedSmtp?.username || emailData.fromEmail,
        fromName: emailData.fromName || selectedSmtp?.displayName || (selectedSmtp?.username || '').split('@')[0],
        sentAt: new Date().toISOString(),
        status: 'sent',
        attachments: attachments.map(att => att.name),
        recipients: emailData.to.split(',').length,
        smtpId: selectedSmtp?.id,
        smtpProvider: selectedSmtp?.provider
      };
      addEmail(sentEmail);
      toast.success('Test email simulated locally (demo mode)');
    } finally {
      setSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (!selectedSmtp && !useMultipleSmtp) {
      toast.error('Please configure and select an SMTP server first');
      navigate('/smtp');
      return;
    }

    if (selectedContacts.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    if (!emailData.subject || (!emailData.body && !emailData.htmlBody)) {
      toast.error('Please fill in subject and email content');
      return;
    }

    setSending(true);
    try {
      // Build recipients list
      const recipients = selectedContacts.map(contact => ({
        email: contact.email,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        company: contact.company || '',
        phone: contact.phone || ''
      }));

      const storedUser = localStorage.getItem('user');
      const token = storedUser ? JSON.parse(storedUser).token : null;

      if (token) {
        // Send each recipient one-by-one with at least 30s delay
        const total = recipients.length;
        let sentCount = 0;
        let failedCount = 0;

        toast.loading(`Starting sequential send of ${total} recipients (30s interval)`);

        for (let i = 0; i < recipients.length; i++) {
          const contact = recipients[i];

          // choose SMTP per recipient (rotate if multiple selected)
          let smtpForThis = selectedSmtp;
          if (useMultipleSmtp && selectedSmtps && selectedSmtps.length > 0) {
            const smtpId = selectedSmtps[i % selectedSmtps.length];
            smtpForThis = smtpSettings.find(s => s.id === smtpId) || selectedSmtp;
          }

          const toString = contact.email;
          const smtpConfig = smtpForThis ? {
            host: smtpForThis.host || smtpForThis.hostname || smtpForThis.server,
            port: smtpForThis.port || 587,
            secure: smtpForThis.secure === undefined ? (smtpForThis.port === 465) : !!smtpForThis.secure,
            auth: {
              user: smtpForThis.username || smtpForThis.user || smtpForThis.authUser,
              pass: smtpForThis.password || smtpForThis.pass || smtpForThis.authPass
            }
          } : null;

          const payload = {
            to: toString,
            subject: emailData.subject,
            body: emailData.body,
            htmlBody: emailData.htmlBody,
            isHtml: emailData.isHtml,
            fromName: emailData.fromName,
            fromEmail: emailData.fromEmail,
            trackingEnabled: emailData.trackingEnabled,
            smtpConfig
          };

          try {
            // send single email
            const res = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(payload)
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              failedCount++;
              console.error('Send failed for', toString, json);
            } else {
              sentCount++;
            }
          } catch (err) {
            failedCount++;
            console.error('Error sending to', contact.email, err);
          }

          // update toast/progress
          toast.loading(`Progress: ${sentCount}/${total} sent, ${failedCount} failed`);

          // wait 30 seconds before next send unless last
          if (i < recipients.length - 1) await new Promise(r => setTimeout(r, 30000));
        }

        toast.remove();
        toast.success(`Sequential send completed. Sent: ${sentCount}, Failed: ${failedCount}`);
        navigate('/history');
        setSending(false);
        return;
      }

      // Local fallback: distribute across selected SMTPs
      const smtps = useMultipleSmtp && selectedSmtps.length > 0
        ? smtpSettings.filter(s => selectedSmtps.includes(s.id))
        : (selectedSmtp ? [selectedSmtp] : [getDefaultSmtp()]);

      toast.loading(`Sending ${recipients.length} emails using ${smtps.length} SMTP(s)...`);

      for (let i = 0; i < recipients.length; i++) {
        const contact = recipients[i];
        const smtp = smtps[i % smtps.length];

        let processedBody = emailData.body;
        let processedSubject = emailData.subject;
        const placeholders = {
          '{{first_name}}': contact.firstName || '',
          '{{last_name}}': contact.lastName || '',
          '{{email}}': contact.email,
          '{{company}}': contact.company || '',
          '{{phone}}': contact.phone || ''
        };
        Object.entries(placeholders).forEach(([placeholder, value]) => {
          processedBody = processedBody.replace(new RegExp(placeholder, 'g'), value);
          processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value);
        });

        const sentEmail = {
          ...emailData,
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          to: [{ email: contact.email, name: `${contact.firstName} ${contact.lastName}`.trim() }],
          subject: processedSubject,
          body: processedBody,
          htmlBody: processedBody,
          fromEmail: smtp.username || emailData.fromEmail,
          fromName: emailData.fromName || smtp.fromName || (smtp.username || '').split('@')[0],
          sentAt: new Date().toISOString(),
          status: 'sent',
          attachments: attachments.map(att => att.name),
          recipients: 1,
          smtpId: smtp.id,
          smtpProvider: smtp.provider
        };

        addEmail(sentEmail);
        await new Promise(r => setTimeout(r, 50));
      }

      toast.success(`Bulk email campaign completed! Sent ${recipients.length} emails.`);
      navigate('/history');
    } catch (error) {
      toast.error(`Failed to send bulk emails: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setEmailData(prev => ({
      ...prev,
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      htmlBody: '',
      templateId: ''
    }));
    setAttachments([]);
    setSelectedContacts([]);
    setSelectedTemplate(null);
    toast.success('Form cleared');
  };

  const filteredContacts = contacts.filter(contact =>
    contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card elevation={2} sx={{ mb: 3, height: 'calc(50% - 12px)' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Contact Manager
              </Typography>

              <Box mb={2}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  sx={{ mb: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <Box display="flex" gap={1} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const toSelect = filteredContacts;
                            setSelectedContacts(toSelect);
                            const emails = toSelect.map(c => c.email).join(', ');
                            setEmailData(ed => ({ ...ed, to: emails }));
                          } else {
                            setSelectedContacts([]);
                            setEmailData(ed => ({ ...ed, to: '' }));
                          }
                        }}
                        size="small"
                      />
                    }
                    label="All"
                  />

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/contacts')}
                    sx={{ ml: 1 }}
                  >
                    Manage Contacts
                  </Button>

                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      setSelectedContacts([]);
                      setEmailData(ed => ({ ...ed, to: '' }));
                    }}
                    sx={{ ml: 1 }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>

              <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 200 }}>
                {filteredContacts.slice(0, 10).map((contact) => (
                  <Box
                    key={contact.id}
                    sx={{
                      p: 1,
                      mb: 1,
                      borderRadius: 1,
                      bgcolor: selectedContacts.find(c => c.id === contact.id) ? 'action.selected' : 'transparent',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => handleContactSelect(contact)}
                  >
                      <Box display="flex" gap={1} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {contact.firstName} {contact.lastName}
                        </Typography>
                      </Box>
                    <Typography variant="caption" color="textSecondary" noWrap>
                      {contact.email}
                    </Typography>
                  </Box>
                ))}

                {filteredContacts.length === 0 && (
                  <Typography variant="body2" color="textSecondary" align="center" sx={{ py: 2 }}>
                    {contacts.length === 0 ? 'No contacts found' : 'No contacts match search'}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold">
                  Compose Email
                  {selectedSmtp && (
                    <Typography variant="caption" color="primary" sx={{ ml: 2 }}>
                      Sending via: {selectedSmtp.provider} ({selectedSmtp.username})
                    </Typography>
                  )}
                </Typography>
                <Box>
                  <Tooltip title="Preview Email">
                    <Button
                      variant="outlined"
                      startIcon={<Preview />}
                      onClick={() => setPreviewOpen(true)}
                      sx={{ mr: 1 }}
                    >
                      Preview
                    </Button>
                  </Tooltip>
                  <Tooltip title="Send Test Email">
                    <Button
                      variant="contained"
                      startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
                      onClick={handleSendTest}
                      disabled={sending || !selectedSmtp}
                    >
                      {sending ? 'Sending...' : 'Send Test'}
                    </Button>
                  </Tooltip>
                </Box>
              </Box>

              {!selectedSmtp && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    No active SMTP server selected. Please configure SMTP servers first.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate('/smtp')}
                    sx={{ mt: 1 }}
                  >
                    Configure SMTP
                  </Button>
                </Alert>
              )}

              <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} sx={{ mb: 3 }}>
                <Tab label="Recipients" />
                <Tab label="Content" />
                <Tab label="Settings" />
              </Tabs>

              {activeTab === 0 && (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="To *"
                        value={emailData.to}
                        onChange={handleInputChange}
                        name="to"
                        placeholder="recipient@example.com"
                        helperText={selectedContacts.length > 0 ? `${selectedContacts.length} contacts selected` : 'Enter email addresses separated by commas'}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="CC"
                        value={emailData.cc}
                        onChange={handleInputChange}
                        name="cc"
                        placeholder="cc@example.com"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="BCC"
                        value={emailData.bcc}
                        onChange={handleInputChange}
                        name="bcc"
                        placeholder="bcc@example.com"
                      />
                    </Grid>
                  </Grid>

                  {selectedContacts.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Selected Contacts:
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {selectedContacts.map(contact => (
                          <Chip
                            key={contact.id}
                            label={`${contact.firstName} ${contact.lastName}`}
                            onDelete={() => handleRemoveContact(contact.id)}
                            size="small"
                            icon={<PersonIcon />}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {activeTab === 1 && (
                <Box>
                  <TextField
                    fullWidth
                    label="Subject *"
                    value={emailData.subject}
                    onChange={handleInputChange}
                    name="subject"
                    sx={{ mb: 3 }}
                    required
                  />

                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                    <Box sx={{ p: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        <Button
                          startIcon={<TextFields />}
                          onClick={() => setEmailData(prev => ({ ...prev, isHtml: false }))}
                          variant={!emailData.isHtml ? 'contained' : 'outlined'}
                          size="small"
                        >
                          Plain Text
                        </Button>
                        <Button
                          startIcon={<Code />}
                          onClick={() => setEmailData(prev => ({ ...prev, isHtml: true }))}
                          variant={emailData.isHtml ? 'contained' : 'outlined'}
                          size="small"
                        >
                          HTML
                        </Button>
                        <Button
                          startIcon={<Upload />}
                          component="label"
                          size="small"
                          variant="outlined"
                        >
                          Import HTML
                          <input
                            type="file"
                            accept=".html,.htm"
                            hidden
                            onChange={handleHTMLImport}
                            ref={htmlInputRef}
                          />
                        </Button>
                      </Box>
                    </Box>
                    
                    <Box sx={{ p: 2, minHeight: 300 }}>
                      {emailData.isHtml ? (
                        <textarea
                          id="emailBody"
                          value={emailData.htmlBody}
                          onChange={(e) => setEmailData(prev => ({ ...prev, htmlBody: e.target.value }))}
                          style={{
                            width: '100%',
                            height: '250px',
                            fontFamily: 'monospace',
                            border: 'none',
                            outline: 'none',
                            resize: 'vertical',
                            fontSize: '14px'
                          }}
                          placeholder="Write your HTML email here... You can use {{first_name}}, {{last_name}}, {{email}}, {{company}} placeholders."
                        />
                      ) : (
                        <textarea
                          id="emailBody"
                          value={emailData.body}
                          onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
                          style={{
                            width: '100%',
                            height: '250px',
                            fontFamily: 'inherit',
                            border: 'none',
                            outline: 'none',
                            resize: 'vertical',
                            fontSize: '14px'
                          }}
                          placeholder="Write your email here... You can use {{first_name}}, {{last_name}}, {{email}}, {{company}} placeholders."
                        />
                      )}
                    </Box>
                  </Box>

                  <Box {...getRootProps()} sx={{ 
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    mb: 2,
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}>
                    <input {...getInputProps()} />
                    <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                    <Typography variant="h6" gutterBottom>
                      Drag & drop files here
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      or click to select (max 10MB each)
                    </Typography>
                  </Box>

                  {attachments.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Attachments ({attachments.length})
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {attachments.map(attachment => (
                          <Chip
                            key={attachment.id}
                            label={`${attachment.name} (${(attachment.size / 1024).toFixed(1)}KB)`}
                            onDelete={() => handleRemoveAttachment(attachment.id)}
                            deleteIcon={<DeleteIcon />}
                            variant="outlined"
                            icon={<AttachFileIcon />}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {activeTab === 2 && (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Send From (SMTP Account) *</InputLabel>
                      <Select
                        value={emailData.smtpId}
                        onChange={handleInputChange}
                        name="smtpId"
                        label="Send From (SMTP Account) *"
                        required
                      >
                        {activeSmtpAccounts.map(smtp => (
                          <MenuItem key={smtp.id} value={smtp.id}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  bgcolor: getProviderColor(smtp.provider),
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: 10
                                }}
                              >
                                {smtp.provider?.charAt(0)}
                              </Box>
                              <Box>
                                <Typography variant="body2">
                                  {smtp.username} ({smtp.provider})
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {smtp.host}:{smtp.port}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <FormControlLabel
                          control={<Switch checked={useMultipleSmtp} onChange={(e) => setUseMultipleSmtp(e.target.checked)} />}
                          label="Use multiple SMTPs"
                        />
                        {/* <FormControlLabel
                          control={<Switch checked={campaignRequired} onChange={(e) => setCampaignRequired(e.target.checked)} />}
                          label="Create Campaign"
                        /> */}
                        {campaignRequired && (
                          <TextField
                            size="small"
                            placeholder="Campaign name (optional)"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                          />
                        )}
                        {useMultipleSmtp && (
                          <FormControl sx={{ minWidth: 220 }}>
                            <InputLabel>SMTP Accounts</InputLabel>
                            <Select
                              multiple
                              value={selectedSmtps}
                              onChange={(e) => setSelectedSmtps(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                              label="SMTP Accounts"
                            >
                              {activeSmtpAccounts.map(smtp => (
                                <MenuItem key={smtp.id} value={smtp.id}>
                                  {smtp.username} ({smtp.provider})
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </Box>
                      {activeSmtpAccounts.length === 0 && (
                        <Typography variant="caption" color="error">
                          No active SMTP servers. Please configure SMTP first.
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>

                  {selectedSmtp && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Name"
                          value={emailData.fromName}
                          onChange={handleInputChange}
                          name="fromName"
                          helperText="Display name for sender"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="From Email"
                          value={emailData.fromEmail}
                          onChange={handleInputChange}
                          name="fromEmail"
                          type="email"
                          disabled
                          helperText="Email from SMTP account"
                        />
                      </Grid>
                    </>
                  )}

                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={emailData.trackingEnabled}
                          onChange={(e) => setEmailData(prev => ({ ...prev, trackingEnabled: e.target.checked }))}
                          name="trackingEnabled"
                        />
                      }
                      label="Enable Tracking"
                    />
                    <Typography variant="caption" color="textSecondary" display="block">
                      Track opens and clicks
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                SMTP Status
              </Typography>
              
              {selectedSmtp ? (
                <>
                  <Box sx={{ p: 2, bgcolor: 'success.lightest', borderRadius: 1, mb: 2 }}>
                    <Typography variant="body2" fontWeight="medium">
                      Active: {selectedSmtp.provider}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {selectedSmtp.username}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {selectedSmtp.host}:{selectedSmtp.port}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Sent today: {selectedSmtp.emailsSentToday || 0} / {selectedSmtp.maxEmailsPerDay || 500}
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={Math.min(100, ((selectedSmtp.emailsSentToday || 0) / (selectedSmtp.maxEmailsPerDay || 500)) * 100)}
                        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                  
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {activeSmtpAccounts.length} active SMTP server(s) available
                  </Alert>
                </>
              ) : (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No active SMTP server selected
                </Alert>
              )}

              <Button
                fullWidth
                variant="contained"
                sx={{ mb: 1 }}
                onClick={() => navigate('/smtp')}
              >
                Configure SMTP
              </Button>
            </CardContent>
          </Card>

          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Send Options
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                Ready to send to {selectedContacts.length || (emailData.to ? emailData.to.split(',').length : 1)} recipient(s)
                {selectedSmtp && ` via ${selectedSmtp.provider}`}
              </Alert>

              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={sending ? <CircularProgress size={20} /> : <SendIcon />}
                onClick={handleBulkSend}
                disabled={sending || !selectedSmtp || (!selectedContacts.length && !emailData.to)}
                sx={{ mb: 1, py: 1.5 }}
              >
                {sending ? 'Sending...' : 
                  selectedContacts.length > 1 ? `Send to ${selectedContacts.length} Contacts` : 
                  emailData.to ? 'Send Email' : 'Send to Selected'
                }
              </Button>

              <Box display="flex" gap={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  onClick={resetForm}
                >
                  Clear All
                </Button>
                {/* <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate('/campaign')}
                >
                  Create Campaign
                </Button> */}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Subject: {emailData.subject || '(No subject)'}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              From: {emailData.fromName} &lt;{emailData.fromEmail}&gt;
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              To: {emailData.to || '(No recipients)'}
            </Typography>
            {selectedSmtp && (
              <Typography variant="caption" color="textSecondary" gutterBottom display="block">
                Sending via: {selectedSmtp.provider}
              </Typography>
            )}
            <Divider sx={{ my: 2 }} />
            <Box
              dangerouslySetInnerHTML={{ 
                __html: emailData.isHtml 
                  ? emailData.htmlBody || emailData.body || '<p style="color: #666; font-style: italic;">No email content</p>'
                  : `<pre style="white-space: pre-wrap; font-family: inherit; margin: 0;">${emailData.body || 'No email content'}</pre>`
              }}
              sx={{ minHeight: 300 }}
            />
            
            {attachments.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Attachments ({attachments.length}):
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {attachments.map(attachment => (
                    <Chip
                      key={attachment.id}
                      label={attachment.name}
                      icon={<AttachFileIcon />}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

// Add this function for provider colors
const getProviderColor = (providerName) => {
  const providers = [
    { value: 'Gmail', color: '#EA4335' },
    { value: 'Outlook/Hotmail', color: '#0078D4' },
    { value: 'SendGrid', color: '#00C7E6' },
    { value: 'Mailgun', color: '#5C6BC0' },
    { value: 'AWS SES', color: '#FF9900' },
    { value: 'Custom', color: '#666666' }
  ];
  
  if (!providerName) return '#666666';
  const provider = providers.find(p => p.value === providerName);
  return provider?.color || '#666666';
};

export default Compose;