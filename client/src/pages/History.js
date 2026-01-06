import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  Grid,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  LinearProgress,
  Divider,
  Avatar
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  CheckCircle,
  Error,
  Schedule,
  Download,
  CalendarToday,
  Person,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import toast from 'react-hot-toast';

const History = () => {
  const { emails, stats } = useEmail();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [filteredEmails, setFilteredEmails] = useState([]);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    filterEmails();
  }, [emails, searchTerm, statusFilter, dateFilter, sortBy]);

  const filterEmails = () => {
    let filtered = [...emails];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(email =>
        email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.to?.some(recipient => 
          recipient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          recipient.name?.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        email.fromEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.fromName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(email => email.status === statusFilter);
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      filtered = filtered.filter(email => {
        const emailDate = new Date(email.sentAt).toDateString();
        return emailDate === filterDate;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.sentAt) - new Date(a.sentAt);
      } else if (sortBy === 'oldest') {
        return new Date(a.sentAt) - new Date(b.sentAt);
      } else if (sortBy === 'subject') {
        return (a.subject || '').localeCompare(b.subject || '');
      }
      return 0;
    });

    setFilteredEmails(filtered);
  };

  const handleViewEmail = (email) => {
    setSelectedEmail(email);
    setViewDialogOpen(true);
  };

  const handleDeleteEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to delete this email record?')) return;

    const storedUser = localStorage.getItem('user');
    const token = storedUser ? JSON.parse(storedUser).token : null;

    if (token) {
      try {
        const res = await fetch(`/api/email/${emailId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Delete failed');
        toast.success(json.message || 'Email record deleted');
        // Reload recent emails from server
        window.location.reload();
      } catch (err) {
        toast.error(err.message || 'Failed to delete email');
      }
      return;
    }

    // Local-only fallback
    const savedEmails = JSON.parse(localStorage.getItem('emails')) || [];
    const updatedEmails = savedEmails.filter(email => (email.id || email._id) !== emailId);
    localStorage.setItem('emails', JSON.stringify(updatedEmails));
    window.location.reload();
    toast.success('Email record deleted');
  };

  const handleExportHistory = () => {
    const csvContent = [
      ['Date', 'To', 'Subject', 'Status', 'Recipients', 'Campaign'],
      ...filteredEmails.map(email => [
        new Date(email.sentAt).toLocaleString(),
        email.to?.map(r => r.email).join('; ') || '',
        email.subject,
        email.status,
        email.recipients || 1,
        email.campaignId ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Email history exported to CSV!');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all email history? This cannot be undone.')) return;

    const storedUser = localStorage.getItem('user');
    const token = storedUser ? JSON.parse(storedUser).token : null;

    if (token) {
      try {
        const res = await fetch('/api/email/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ all: true })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to clear history');
        toast.success(json.message || 'Email history cleared');
        window.location.reload();
      } catch (err) {
        toast.error(err.message || 'Failed to clear history');
      }
      return;
    }

    localStorage.removeItem('emails');
    window.location.reload();
    toast.success('Email history cleared');
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'sent':
        return <Chip label="Sent" color="success" size="small" icon={<CheckCircle />} />;
      case 'failed':
        return <Chip label="Failed" color="error" size="small" icon={<Error />} />;
      case 'pending':
        return <Chip label="Pending" color="warning" size="small" icon={<Schedule />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Calculate statistics
  const totalSent = emails.filter(e => e.status === 'sent').length;
  const totalFailed = emails.filter(e => e.status === 'failed').length;
  const totalPending = emails.filter(e => e.status === 'pending').length;
  const successRate = emails.length > 0 ? Math.round((totalSent / emails.length) * 100) : 0;

  // Get recent emails (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentEmails = emails.filter(email => new Date(email.sentAt) >= thirtyDaysAgo);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Email History & Analytics
        </Typography>
        <Typography variant="body1" color="textSecondary">
          View sent email history, track performance, and manage email records
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {emails.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Emails
                  </Typography>
                </Box>
                <EmailIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={100} 
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {totalSent}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sent Successfully
                  </Typography>
                </Box>
                <CheckCircle color="success" sx={{ fontSize: 40 }} />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={successRate} 
                color="success"
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="error.main">
                    {totalFailed}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Failed Emails
                  </Typography>
                </Box>
                <Error color="error" sx={{ fontSize: 40 }} />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={emails.length > 0 ? (totalFailed / emails.length) * 100 : 0} 
                color="error"
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {successRate}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Success Rate
                  </Typography>
                </Box>
                <TrendingUp color="warning" sx={{ fontSize: 40 }} />
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={successRate} 
                color="warning"
                sx={{ mt: 1, height: 4, borderRadius: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search emails by subject, recipient, or sender..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort By"
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="subject">Subject A-Z</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Filter by Date"
                value={dateFilter}
                onChange={(newValue) => setDateFilter(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <Box display="flex" gap={1}>
              <Tooltip title="Export History">
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExportHistory}
                  disabled={filteredEmails.length === 0}
                  fullWidth
                >
                  Export
                </Button>
              </Tooltip>
              <Tooltip title="Clear Filters">
                <IconButton onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter(null);
                  setSortBy('newest');
                }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Emails Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date & Time</TableCell>
              <TableCell>Recipient</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Recipients</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmails.length > 0 ? (
              filteredEmails.map((email) => (
                <TableRow key={email.id || email._id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {new Date(email.sentAt).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                        {email.to?.[0]?.name?.charAt(0) || email.to?.[0]?.email?.charAt(0) || 'U'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {email.to?.[0]?.name || email.to?.[0]?.email || 'Unknown'}
                        </Typography>
                        {email.to && email.to.length > 1 && (
                          <Typography variant="caption" color="textSecondary">
                            +{email.to.length - 1} more
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography noWrap sx={{ maxWidth: 250 }}>
                      {email.subject || 'No Subject'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(email.status)}
                  </TableCell>
                  <TableCell>
                    <Typography>{email.recipients || 1}</Typography>
                  </TableCell>
                  <TableCell>
                    {email.campaignId ? (
                      <Chip label="Campaign" size="small" color="primary" />
                    ) : (
                      <Typography variant="caption" color="textSecondary">Single</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewEmail(email)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Record">
                        <IconButton size="small" onClick={() => handleDeleteEmail(email.id || email._id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Box textAlign="center">
                    <EmailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography color="textSecondary">
                      {emails.length === 0 ? 'No email history yet' : 'No emails match your filters'}
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination/Info */}
      {filteredEmails.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, p: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Showing {filteredEmails.length} of {emails.length} emails
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClearHistory}
            disabled={emails.length === 0}
          >
            Clear All History
          </Button>
        </Box>
      )}

      {/* View Email Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedEmail && (
          <>
            <DialogTitle>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Email Details</Typography>
                {getStatusChip(selectedEmail.status)}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Subject
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {selectedEmail.subject || 'No Subject'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Sent At
                  </Typography>
                  <Typography variant="body1">
                    {new Date(selectedEmail.sentAt).toLocaleString()}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Recipients
                  </Typography>
                  <Typography variant="body1">
                    {selectedEmail.recipients || 1}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    From
                  </Typography>
                  <Typography variant="body1">
                    {selectedEmail.fromName} &lt;{selectedEmail.fromEmail}&gt;
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    Campaign
                  </Typography>
                  <Typography variant="body1">
                    {selectedEmail.campaignId ? 'Yes' : 'No'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    To
                  </Typography>
                  <Box sx={{ maxHeight: 150, overflow: 'auto', p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    {selectedEmail.to?.map((recipient, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        {recipient.name} &lt;{recipient.email}&gt;
                      </Typography>
                    )) || 'No recipients'}
                  </Box>
                </Grid>
                
                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Attachments ({selectedEmail.attachments.length})
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {selectedEmail.attachments.map((attachment, index) => (
                        <Chip
                          key={index}
                          label={attachment}
                          size="small"
                          icon={<EmailIcon />}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Email Content
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                      maxHeight: 300,
                      overflow: 'auto',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {selectedEmail.isHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody || selectedEmail.body }} />
                    ) : (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                        {selectedEmail.body}
                      </pre>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default History;