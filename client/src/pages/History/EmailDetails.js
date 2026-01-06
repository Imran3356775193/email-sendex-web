import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Grid,
  IconButton,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Visibility as VisibilityIcon,
  Link as LinkIcon,
  Cloud as CloudIcon
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';

const EmailDetails = ({ email }) => {
  const { smtpSettings } = useEmail();
  
  // Find the SMTP account used
  const smtpUsed = smtpSettings.find(s => s.id === email.smtpId);
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Email Details
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              {email.subject || '(No subject)'}
            </Typography>
            
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Chip 
                icon={<ScheduleIcon />} 
                label={formatDate(email.sentAt)} 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                icon={<CheckCircleIcon color="success" />} 
                label="Sent" 
                size="small" 
                color="success" 
                variant="outlined" 
              />
              {email.trackingEnabled && (
                <Chip 
                  icon={<VisibilityIcon />} 
                  label={`${email.opens || 0} opens`} 
                  size="small" 
                  variant="outlined" 
                />
              )}
            </Box>
          </Box>
        </Grid>
        
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Sender Information
          </Typography>
          
          <Box sx={{ pl: 3 }}>
            <Typography variant="body2" gutterBottom>
              <strong>From Name:</strong> {email.fromName}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>From Email:</strong> {email.fromEmail}
            </Typography>
            
            {smtpUsed && (
              <>
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.lightest', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <CloudIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                    SMTP Server Used
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Provider:</strong> {smtpUsed.provider}
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Host:</strong> {smtpUsed.host}:{smtpUsed.port}
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Username:</strong> {smtpUsed.username}
                  </Typography>
                  {smtpUsed.isDefault && (
                    <Chip label="Default Server" size="small" color="primary" sx={{ mt: 1 }} />
                  )}
                </Box>
              </>
            )}
          </Box>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recipient Information
          </Typography>
          
          <Box sx={{ pl: 3 }}>
            <Typography variant="body2" gutterBottom>
              <strong>To:</strong> {Array.isArray(email.to) 
                ? email.to.map(r => r.email).join(', ')
                : email.to}
            </Typography>
            {email.cc && (
              <Typography variant="body2" gutterBottom>
                <strong>CC:</strong> {email.cc}
              </Typography>
            )}
            {email.bcc && (
              <Typography variant="body2" gutterBottom>
                <strong>BCC:</strong> {email.bcc}
              </Typography>
            )}
            <Typography variant="body2">
              <strong>Recipients:</strong> {email.recipients || 1}
            </Typography>
          </Box>
        </Grid>
        
        {email.attachments && email.attachments.length > 0 && (
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
              Attachments ({email.attachments.length})
            </Typography>
            <Box sx={{ pl: 3 }}>
              {email.attachments.map((attachment, index) => (
                <Chip
                  key={index}
                  label={attachment}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            Email Content
          </Typography>
          
          <Box sx={{ 
            p: 2, 
            bgcolor: 'background.default', 
            borderRadius: 1,
            maxHeight: 400,
            overflow: 'auto'
          }}>
            {email.isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: email.htmlBody || email.body }} />
            ) : (
              <pre style={{ 
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                margin: 0
              }}>
                {email.body}
              </pre>
            )}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default EmailDetails;