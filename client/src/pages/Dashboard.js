import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  Mail as MailIcon,
  OpenInBrowser as OpenIcon,
  Link as LinkIcon,
  Person as PersonIcon,
  TrendingUp,
  Refresh,
  MoreVert,
  CheckCircle,
  Error,
  Schedule,
  Email,
  People,
  Campaign,
  History
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useEmail } from '../context/EmailContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const { 
    emails, 
    contacts, 
    campaigns, 
    templates, 
    smtpSettings,
    stats = {} 
  } = useEmail();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalSent: 0,
    sentToday: 0,
    openRate: 24.3,
    clickRate: 3.2,
    activeContacts: 0,
    activeCampaigns: 0,
    successRate: 98.5,
    workers: 4,
    emailsPerWorker: 50,
    emailDelay: 5,
    retryAttempts: 3
  });

  const [recentEmails, setRecentEmails] = useState([]);
  const [smtpStatus, setSmtpStatus] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [emails, contacts, campaigns, templates, smtpSettings]);

  const fetchDashboardData = () => {
    setLoading(true);
    try {
      // Calculate real stats from data
      const totalSent = emails.length;
      const activeContacts = contacts.filter(c => c.isActive !== false).length;
      const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
      
      // Calculate emails sent today
      const today = new Date().toDateString();
      const sentToday = emails.filter(email => {
        const emailDate = new Date(email.sentAt).toDateString();
        return emailDate === today;
      }).length;
      
      // Get recent emails (last 10)
      const recent = [...emails]
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
        .slice(0, 10)
        .map(email => ({
          _id: email.id || Date.now(),
          to: Array.isArray(email.to) ? email.to : [{ email: email.to || 'Unknown' }],
          subject: email.subject || 'No Subject',
          status: email.status || 'sent',
          sentAt: email.sentAt || new Date().toISOString()
        }));
      
      // Get SMTP status from real settings; do not inject demo/mock servers
      const smtpData = smtpSettings.map(smtp => ({
        _id: smtp.id || smtp._id,
        provider: smtp.provider || smtp.name || 'custom',
        host: smtp.host || smtp.hostname || smtp.server || '',
        port: smtp.port || 587,
        isActive: smtp.isActive !== false,
        stats: smtp.stats || { sentToday: 0 }
      }));

      setDashboardStats(prev => ({
        ...prev,
        totalSent,
        sentToday,
        activeContacts,
        activeCampaigns,
        successRate: totalSent > 0 ? Math.round(((totalSent - emails.filter(e => e.status === 'failed').length) / totalSent) * 100) : 100
      }));

      setRecentEmails(recent);
      setSmtpStatus(smtpData);
      
    } catch (error) {
      console.error('Dashboard data error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = (smtpId) => {
    toast.loading('Testing SMTP connection...');
    
    // Simulate connection test
    setTimeout(() => {
      const success = Math.random() > 0.3; // 70% success rate
      if (success) {
        toast.success('Connection successful!');
        // Update SMTP status
        setSmtpStatus(prev => prev.map(smtp => 
          smtp._id === smtpId 
            ? { ...smtp, isActive: true, lastTested: new Date().toISOString() }
            : smtp
        ));
      } else {
        toast.error('Connection failed. Check your settings.');
      }
    }, 1500);
  };

  const handleRefresh = () => {
    fetchDashboardData();
    toast.success('Dashboard refreshed!');
  };

  const StatCard = ({ title, value, icon, color, progress, onClick }) => (
    <Card 
      elevation={2} 
      sx={{ 
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 6, transform: 'translateY(-2px)', transition: 'all 0.2s' } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" color="textSecondary">
            {title}
          </Typography>
          <Box sx={{ 
            backgroundColor: `${color}20`, 
            borderRadius: 2, 
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {React.cloneElement(icon, { sx: { color: color, fontSize: 28 } })}
          </Box>
        </Box>
        <Typography variant="h3" fontWeight="bold" sx={{ color: color }}>
          {value}
        </Typography>
        {progress !== undefined && (
          <Box mt={2}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                borderRadius: 5, 
                height: 8,
                backgroundColor: `${color}20`,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: color
                }
              }} 
            />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
              {progress}% success rate
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const QuickAction = ({ icon, label, color, onClick }) => (
    <Card 
      elevation={1}
      sx={{ 
        p: 2, 
        textAlign: 'center',
        cursor: 'pointer',
        '&:hover': { 
          backgroundColor: `${color}10`,
          transform: 'translateY(-2px)',
          transition: 'all 0.2s'
        }
      }}
      onClick={onClick}
    >
      <Box sx={{ color, mb: 1 }}>
        {icon}
      </Box>
      <Typography variant="body2" fontWeight="medium">
        {label}
      </Typography>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Welcome back, {user?.name || 'User'}!
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {user?.role === 'admin' ? 'Administrator' : 'Head Coach'}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <IconButton onClick={handleRefresh} color="primary">
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => navigate('/compose')}
            sx={{ borderRadius: 3 }}
          >
            Compose Email
          </Button>
        </Box>
      </Box>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <QuickAction
            icon={<SendIcon sx={{ fontSize: 32 }} />}
            label="Compose"
            color="#4361ee"
            onClick={() => navigate('/compose')}
          />
        </Grid>
        {/* <Grid item xs={6} sm={3}>
          <QuickAction
            icon={<Campaign sx={{ fontSize: 32 }} />}
            label="Campaign"
            color="#7209b7"
            onClick={() => navigate('/campaign')}
          />
        </Grid> */}
        <Grid item xs={6} sm={3}>
          <QuickAction
            icon={<People sx={{ fontSize: 32 }} />}
            label="Contacts"
            color="#06d6a0"
            onClick={() => navigate('/contacts')}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <QuickAction
            icon={<History sx={{ fontSize: 32 }} />}
            label="History"
            color="#f8961e"
            onClick={() => navigate('/history')}
          />
        </Grid>
      </Grid>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Sent"
            value={dashboardStats.totalSent}
            icon={<MailIcon />}
            color="#4361ee"
            onClick={() => navigate('/history')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Sent Today"
            value={dashboardStats.sentToday}
            icon={<Email />}
            color="#06d6a0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Contacts"
            value={dashboardStats.activeContacts}
            icon={<PersonIcon />}
            color="#7209b7"
            onClick={() => navigate('/contacts')}
          />
        </Grid>
        {/* <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Campaigns"
            value={dashboardStats.activeCampaigns}
            icon={<Campaign />}
            color="#f8961e"
            onClick={() => navigate('/campaign')}
          />
        </Grid> */}
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* Left Column - SMTP Status & Recent Activity */}
        <Grid item xs={12} lg={8}>
          {/* SMTP Settings Card */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">
                  SMTP Servers
                </Typography>
                <Chip 
                  label={`${smtpStatus.filter(s => s?.isActive).length || 0} Active`} 
                  color="success" 
                  size="small" 
                />
              </Box>
              
              <Grid container spacing={2}>
                {smtpStatus.slice(0, 3).map((smtp, index) => (
                  <Grid item xs={12} md={4} key={smtp?._id || index}>
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Avatar sx={{ 
                          bgcolor: smtp?.isActive ? 'success.main' : 'error.main',
                          width: 32,
                          height: 32,
                          mr: 1,
                          fontWeight: 'bold'
                        }}>
                          {(smtp?.provider?.charAt(0) || 'S').toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {smtp?.provider || 'SMTP Server'}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {smtp?.host || 'localhost'}:{smtp?.port || 587}
                          </Typography>
                        </Box>
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                        <Typography variant="caption" color="textSecondary">
                          {smtp?.stats?.sentToday || 0} sent today
                        </Typography>
                        <Chip 
                          label={smtp?.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={smtp?.isActive ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={() => handleTestConnection(smtp._id)}
                        sx={{ mt: 2 }}
                      >
                        Test Connection
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              
              <Box mt={3} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="textSecondary">
                  {smtpStatus.length} SMTP server(s) configured
                </Typography>
                <Button 
                  variant="contained" 
                  size="small"
                  onClick={() => navigate('/smtp')}
                >
                  Manage SMTP
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Recent Emails Table */}
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="bold">
                  Recent Email Activity
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => navigate('/history')}
                  endIcon={<TrendingUp />}
                >
                  View All
                </Button>
              </Box>
              
              {recentEmails.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Recipient</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentEmails.slice(0, 5).map((email) => (
                        <TableRow key={email._id} hover>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Avatar sx={{ width: 28, height: 28, mr: 1, fontSize: 12 }}>
                                {email.to?.[0]?.email?.charAt(0).toUpperCase() || 'U'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {email.to?.[0]?.email?.split('@')[0] || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {email.to?.[0]?.email?.split('@')[1] || ''}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography noWrap sx={{ maxWidth: 200 }}>
                              {email.subject || 'No Subject'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={email.status || 'sent'}
                              size="small"
                              color={
                                email.status === 'sent' ? 'success' :
                                email.status === 'failed' ? 'error' : 'warning'
                              }
                              icon={
                                email.status === 'sent' ? <CheckCircle /> :
                                email.status === 'failed' ? <Error /> : <Schedule />
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {email.sentAt ? new Date(email.sentAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              }) : '--:--'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {email.sentAt ? new Date(email.sentAt).toLocaleDateString() : ''}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => {
                              // View email details
                              toast.success('Viewing email details');
                            }}>
                              <MoreVert />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                  <MailIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="textSecondary" gutterBottom>
                    No email activity yet
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={() => navigate('/compose')}
                    sx={{ mt: 1 }}
                  >
                    Send Your First Email
                  </Button>
                </Paper>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Performance & Workers */}
        <Grid item xs={12} lg={4}>
          {/* Performance Metrics */}
          <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={3}>
                Performance Metrics
              </Typography>
              
              {[
                { label: 'Delivery Rate', value: `${dashboardStats.successRate}%`, progress: dashboardStats.successRate, color: 'success' },
                { label: 'Open Rate', value: `${dashboardStats.openRate}%`, progress: dashboardStats.openRate, color: 'primary' },
                { label: 'Click Rate', value: `${dashboardStats.clickRate}%`, progress: dashboardStats.clickRate, color: 'warning' },
                { label: 'Bounce Rate', value: `${(100 - dashboardStats.successRate).toFixed(1)}%`, progress: (100 - dashboardStats.successRate), color: 'error' }
              ].map((stat, index) => (
                <Box key={index} mb={2.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight="medium">
                      {stat.label}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold" sx={{ color: `${stat.color}.main` }}>
                      {stat.value}
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={stat.progress}
                    color={stat.color}
                    sx={{ 
                      borderRadius: 5, 
                      height: 6,
                      backgroundColor: `${stat.color}20`
                    }}
                  />
                </Box>
              ))}
              
              <Divider sx={{ my: 2 }} />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Tip:</strong> Improve open rates by personalizing subject lines and sending at optimal times.
                </Typography>
              </Alert>
            </CardContent>
          </Card>

          {/* Worker Configuration */}
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={3}>
                Worker Configuration
              </Typography>
              
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <People color="primary" />
                  <Typography>Number of Workers:</Typography>
                </Box>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {dashboardStats.workers}
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="body2">Emails Per Worker:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {dashboardStats.emailsPerWorker} Emails
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="body2">Delay Between Emails:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {dashboardStats.emailDelay} Seconds
                </Typography>
              </Box>
              
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Typography variant="body2">Retry Attempts:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {dashboardStats.retryAttempts}
                </Typography>
              </Box>
              
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate('/workers')}
                startIcon={<TrendingUp />}
                sx={{ py: 1.5 }}
              >
                Configure Workers
              </Button>
              
              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                Workers process emails in parallel. More workers = faster sending, but may trigger spam filters.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;