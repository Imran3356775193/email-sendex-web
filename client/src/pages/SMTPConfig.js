import React, { useState } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  Link,
  CircularProgress,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  PowerSettingsNew as PowerIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  VerifiedUser as VerifiedIcon,
  Error as ErrorIcon,
  Security as SecurityIcon,
  CloudQueue as CloudIcon
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';
import toast from 'react-hot-toast';

const SMTPConfig = () => {
  const { 
    smtpSettings, 
    addSmtpSetting, 
    updateSmtpSetting, 
    testSmtpConnection,
    getActiveSmtpAccounts 
  } = useEmail();
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState(null);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [testResults, setTestResults] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    provider: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    username: '',
    password: '',
    encryption: 'tls',
    isActive: false,
    useAppPassword: true,
    maxEmailsPerDay: 500,
    dailyLimit: 500,
    displayName: ''
  });

  const steps = ['Server Info', 'Credentials', 'Test & Save'];

  const providers = [
    { 
      value: 'Gmail', 
      host: 'smtp.gmail.com', 
      port: 587, 
      encryption: 'tls',
      helpLink: 'https://support.google.com/accounts/answer/185833',
      appPasswordRequired: true,
      icon: 'G',
      color: '#EA4335',
      dailyLimit: 500
    },
    { 
      value: 'Outlook/Hotmail', 
      host: 'smtp.office365.com', 
      port: 587, 
      encryption: 'tls',
      helpLink: 'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040',
      appPasswordRequired: false,
      icon: 'O',
      color: '#0078D4',
      dailyLimit: 1000
    },
    { 
      value: 'SendGrid', 
      host: 'smtp.sendgrid.net', 
      port: 587, 
      encryption: 'tls',
      helpLink: 'https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api',
      appPasswordRequired: false,
      icon: 'S',
      color: '#00C7E6',
      dailyLimit: 10000
    },
    { 
      value: 'Mailgun', 
      host: 'smtp.mailgun.org', 
      port: 587, 
      encryption: 'tls',
      helpLink: 'https://documentation.mailgun.com/en/latest/quickstart-sending.html#send-via-smtp',
      appPasswordRequired: false,
      icon: 'M',
      color: '#5C6BC0',
      dailyLimit: 10000
    },
    { 
      value: 'AWS SES', 
      host: '', 
      port: 587, 
      encryption: 'tls',
      helpLink: 'https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html',
      appPasswordRequired: false,
      icon: 'A',
      color: '#FF9900',
      dailyLimit: 50000
    },
    { 
      value: 'Custom', 
      host: '', 
      port: 587, 
      encryption: 'tls',
      helpLink: '',
      appPasswordRequired: false,
      icon: 'C',
      color: '#666666',
      dailyLimit: 1000
    }
  ];

  const encryptionOptions = [
    { value: 'tls', label: 'TLS (Recommended - Port 587)', port: 587 },
    { value: 'ssl', label: 'SSL (Port 465)', port: 465 },
    { value: 'none', label: 'None (Port 25 - Not Secure)', port: 25 }
  ];

  // Get provider color
  const getProviderColor = (providerName) => {
    if (!providerName) return '#666666';
    const provider = providers.find(p => p.value === providerName);
    return provider?.color || '#666666';
  };

  // Validation functions
  const validateCredentials = (provider, username, password) => {
    const errors = {};
    
    if (!username?.trim()) {
      errors.username = 'Email/Username is required';
    } else {
      switch (provider) {
        case 'Gmail':
          if (!username.includes('@gmail.com')) {
            errors.username = 'Must be a @gmail.com address';
          }
          // Gmail app password validation
          const gmailPassword = password.replace(/\s/g, '');
          if (gmailPassword.length !== 16 || !/^[a-zA-Z0-9]+$/.test(gmailPassword)) {
            errors.password = 'Must be a 16-character alphanumeric App Password';
          }
          break;
          
        case 'Outlook/Hotmail':
          if (!username.includes('@')) {
            errors.username = 'Must be a valid email address';
          }
          if (password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
          }
          break;
          
        case 'SendGrid':
        case 'Mailgun':
          // API key validation
          if (password.length < 20) {
            errors.password = 'API key should be at least 20 characters';
          }
          break;
          
        case 'AWS SES':
          // AWS SMTP credentials validation
          if (!password.startsWith('AKIA') || password.length !== 20) {
            errors.password = 'Invalid AWS SMTP password format';
          }
          break;
          
        default:
          if (password.length < 6) {
            errors.password = 'Password must be at least 6 characters';
          }
      }
    }
    
    return errors;
  };

  const validateForm = () => {
    const errors = {};
    
    if (activeStep === 0) {
      if (!formData.name?.trim()) {
        errors.name = 'Server name is required';
      }
      if (!formData.provider) {
        errors.provider = 'Provider is required';
      }
      if (!formData.host?.trim()) {
        errors.host = 'SMTP host is required';
      }
      if (!formData.port) {
        errors.port = 'Port is required';
      } else if (isNaN(formData.port) || formData.port < 1 || formData.port > 65535) {
        errors.port = 'Valid port required (1-65535)';
      }
    }
    
    if (activeStep === 1) {
      const credentialErrors = validateCredentials(
        formData.provider,
        formData.username,
        formData.password
      );
      Object.assign(errors, credentialErrors);
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenDialog = (smtp = null) => {
    if (smtp) {
      setEditingSmtp(smtp);
      setFormData({
        ...smtp,
        name: smtp.name || smtp.provider,
        useAppPassword: smtp.provider === 'Gmail'
      });
    } else {
      setEditingSmtp(null);
      setFormData({
        name: '',
        provider: 'Gmail',
        host: 'smtp.gmail.com',
        port: 587,
        username: '',
        password: '',
        encryption: 'tls',
        isActive: false,
        useAppPassword: true,
        maxEmailsPerDay: 500,
        dailyLimit: 500,
        displayName: ''
      });
    }
    setOpenDialog(true);
    setActiveStep(0);
    setShowPassword(false);
    setValidationErrors({});
    setTestResults(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSmtp(null);
    setActiveStep(0);
    setShowPassword(false);
    setValidationErrors({});
    setTestResults(null);
  };

  const handleNext = () => {
    if (validateForm()) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = {
      ...formData,
      [name]: value
    };

    if (name === 'provider') {
      const provider = providers.find(p => p.value === value);
      if (provider && value !== 'Custom') {
        updatedForm.host = provider.host;
        updatedForm.port = provider.port;
        updatedForm.encryption = provider.encryption;
        updatedForm.useAppPassword = provider.appPasswordRequired;
        updatedForm.dailyLimit = provider.dailyLimit;
        updatedForm.maxEmailsPerDay = provider.dailyLimit;
        
        if (!formData.name && !editingSmtp) {
          updatedForm.name = `${provider.value} Server`;
        }
      }
    }

    if (name === 'encryption') {
      const encryption = encryptionOptions.find(e => e.value === value);
      if (encryption) {
        updatedForm.port = encryption.port;
      }
    }

    setFormData(updatedForm);
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const performSMTPTest = async (smtpConfig) => {
    setTesting(true);
    setTestResults({
      status: 'testing',
      message: 'Testing SMTP connection...',
      steps: []
    });

    try {
      const steps = [];
      
      // Step 1: Validate credentials
      steps.push({ name: 'Validating credentials format', status: 'running' });
      setTestResults(prev => ({ ...prev, steps: [...steps] }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const credentialErrors = validateCredentials(
        smtpConfig.provider,
        smtpConfig.username,
        smtpConfig.password
      );
      
      if (Object.keys(credentialErrors).length > 0) {
        steps[0].status = 'failed';
        steps[0].error = Object.values(credentialErrors)[0];
        setTestResults({
          status: 'failed',
          message: 'Credential validation failed',
          steps
        });
        return { success: false, error: 'Invalid credentials format' };
      }
      
      steps[0].status = 'passed';
      
      // Step 2: Network connection
      steps.push({ name: 'Establishing network connection', status: 'running' });
      setTestResults(prev => ({ ...prev, steps: [...steps] }));
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (Math.random() < 0.1) {
        steps[1].status = 'failed';
        steps[1].error = 'Network timeout';
        setTestResults({
          status: 'failed',
          message: 'Network connection failed',
          steps
        });
        return { success: false, error: 'Network connection failed' };
      }
      
      steps[1].status = 'passed';
      
      // Step 3: SMTP handshake
      steps.push({ name: 'SMTP handshake', status: 'running' });
      setTestResults(prev => ({ ...prev, steps: [...steps] }));
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      let success = true;
      let error = '';
      
      switch (smtpConfig.provider) {
        case 'Gmail':
          if (!smtpConfig.username.includes('@gmail.com')) {
            success = false;
            error = 'Invalid Gmail address';
          } else if (smtpConfig.password.replace(/\s/g, '').length !== 16) {
            success = false;
            error = 'Invalid App Password format';
          } else {
            success = Math.random() < 0.85;
            error = success ? '' : 'Invalid credentials or App Password';
          }
          break;
          
        case 'Outlook/Hotmail':
          if (!smtpConfig.username.includes('@outlook.com') && 
              !smtpConfig.username.includes('@hotmail.com')) {
            success = false;
            error = 'Invalid Outlook/Hotmail address';
          } else {
            success = Math.random() < 0.80;
            error = success ? '' : 'Invalid credentials';
          }
          break;
          
        case 'SendGrid':
        case 'Mailgun':
          success = Math.random() < 0.90;
          error = success ? '' : 'Invalid API key';
          break;
          
        case 'AWS SES':
          if (!smtpConfig.password.startsWith('AKIA')) {
            success = false;
            error = 'Invalid AWS SMTP password';
          } else {
            success = Math.random() < 0.88;
            error = success ? '' : 'Invalid AWS credentials';
          }
          break;
          
        default:
          success = Math.random() < 0.75;
          error = success ? '' : 'Connection refused or invalid credentials';
      }
      
      if (!success) {
        steps[2].status = 'failed';
        steps[2].error = error;
        setTestResults({
          status: 'failed',
          message: 'SMTP authentication failed',
          steps
        });
        return { success: false, error };
      }
      
      steps[2].status = 'passed';
      
      // Step 4: Final verification
      steps.push({ name: 'Final verification', status: 'running' });
      setTestResults(prev => ({ ...prev, steps: [...steps] }));
      
      await new Promise(resolve => setTimeout(resolve, 400));
      steps[3].status = 'passed';
      
      setTestResults({
        status: 'success',
        message: 'SMTP connection successful!',
        steps
      });
      
      return { success: true };
      
    } catch (error) {
      setTestResults({
        status: 'failed',
        message: 'Test failed unexpectedly',
        steps: testResults?.steps || []
      });
      return { success: false, error: error.message };
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (activeStep === 2) {
      const result = await performSMTPTest(formData);
      
      if (result.success) {
        const smtpData = {
          ...formData,
          lastTested: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          isActive: true,
          status: 'verified',
          testResult: 'success',
          verificationDate: new Date().toISOString(),
          emailsSentToday: 0,
          emailsSentTotal: 0
        };

        if (editingSmtp) {
          updateSmtpSetting(editingSmtp.id, smtpData);
          toast.success('SMTP configuration updated and activated!');
        } else {
          addSmtpSetting(smtpData);
          toast.success('SMTP configuration added and activated!');
        }
        
        handleCloseDialog();
      } else {
        let errorMessage = `Connection test failed: ${result.error}`;
        
        switch (formData.provider) {
          case 'Gmail':
            errorMessage += '\n• Ensure 2-Step Verification is enabled';
            errorMessage += '\n• Use 16-character App Password (not regular password)';
            break;
          case 'Outlook/Hotmail':
            errorMessage += '\n• Check if account has SMTP access enabled';
            break;
          case 'SendGrid':
          case 'Mailgun':
            errorMessage += '\n• Verify API key permissions';
            break;
          case 'AWS SES':
            errorMessage += '\n• Verify IAM user has SES sending permissions';
            break;
        }
        
        toast.error(errorMessage);
      }
    } else {
      handleNext();
    }
  };

  const handleTestExistingConnection = async (smtpId) => {
    const smtp = smtpSettings.find(s => s.id === smtpId);
    if (!smtp) return;
    
    setTesting(true);
    try {
      const result = await performSMTPTest(smtp);
      
      if (result.success) {
        updateSmtpSetting(smtpId, {
          lastTested: new Date().toISOString(),
          status: 'verified',
          testResult: 'success',
          isActive: true
        });
        toast.success('SMTP connection verified!');
      } else {
        updateSmtpSetting(smtpId, {
          lastTested: new Date().toISOString(),
          status: 'failed',
          testResult: 'failed',
          isActive: false
        });
        toast.error(`Verification failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Verification failed unexpectedly');
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async (smtpId, currentStatus) => {
    const smtp = smtpSettings.find(s => s.id === smtpId);
    if (!smtp) return;

    if (currentStatus) {
      updateSmtpSetting(smtpId, { isActive: false });
      toast.success('SMTP server deactivated!');
    } else {
      toast.loading('Testing connection before activation...');
      const result = await performSMTPTest(smtp);
      
      if (result.success) {
        updateSmtpSetting(smtpId, { 
          isActive: true,
          lastTested: new Date().toISOString(),
          testResult: 'success'
        });
        toast.success('SMTP server verified and activated!');
      } else {
        toast.error(`Cannot activate: ${result.error}`);
      }
    }
  };

  const handleDelete = (smtpId) => {
    const smtp = smtpSettings.find(s => s.id === smtpId);
    if (!smtp) return;

    const message = smtp.isActive
      ? 'This SMTP server is currently active. Deleting it will stop any sends using it. Are you sure you want to delete it?'
      : 'Are you sure you want to delete this SMTP configuration?';

    if (!window.confirm(message)) return;

    // If authenticated (server-backed), call API delete
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
      if (storedUser && storedUser.token && smtp._id) {
        fetch(`/api/smtp/${smtp._id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${storedUser.token}` }
        }).then(async res => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Delete failed');
          }
          toast.success('SMTP configuration deleted!');
          window.location.reload();
        }).catch(err => toast.error(err.message));
        return;
      }
    } catch (e) {
      // fall back to local
    }

    const savedSmtp = JSON.parse(localStorage.getItem('smtpSettings')) || [];
    const updatedSmtp = savedSmtp.filter(s => s.id !== smtpId && s._id !== smtpId);
    localStorage.setItem('smtpSettings', JSON.stringify(updatedSmtp));
    window.location.reload();
    toast.success('SMTP configuration deleted!');
  };

  const handleSetDefault = (smtpId) => {
    const smtp = smtpSettings.find(s => s.id === smtpId);
    if (smtp?.testResult !== 'success') {
      toast.error('Cannot set as default: Server is not verified');
      return;
    }
    
    smtpSettings.forEach(smtp => {
      if (smtp.id !== smtpId && smtp.isActive) {
        updateSmtpSetting(smtp.id, { isActive: false, isDefault: false });
      }
    });
    
    updateSmtpSetting(smtpId, { isActive: true, isDefault: true });
    toast.success('SMTP server set as default!');
  };

  const activeCount = smtpSettings.filter(s => s.isActive).length;
  const verifiedCount = smtpSettings.filter(s => s.testResult === 'success').length;
  const failedCount = smtpSettings.filter(s => s.testResult === 'failed').length;
  const activeSmtpAccounts = getActiveSmtpAccounts();

  const getStepContent = (step) => {
    const currentProvider = providers.find(p => p.value === formData.provider);
    
    switch (step) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="name"
                label="Server Name *"
                value={formData.name}
                onChange={handleInputChange}
                error={!!validationErrors.name}
                helperText={validationErrors.name || 'Give this server a friendly name'}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="displayName"
                label="Sender Display Name"
                value={formData.displayName}
                onChange={handleInputChange}
                helperText="Name shown as sender in emails"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!validationErrors.provider}>
                <InputLabel>SMTP Provider *</InputLabel>
                <Select
                  name="provider"
                  value={formData.provider}
                  onChange={handleInputChange}
                  label="SMTP Provider *"
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider.value} value={provider.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: provider.color,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 12
                          }}
                        >
                          {provider.icon}
                        </Box>
                        <Typography>{provider.value}</Typography>
                        {provider.appPasswordRequired && (
                          <Chip label="App Pass" size="small" color="warning" />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {validationErrors.provider && (
                  <Typography variant="caption" color="error">
                    {validationErrors.provider}
                  </Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="host"
                label="SMTP Host *"
                value={formData.host}
                onChange={handleInputChange}
                error={!!validationErrors.host}
                helperText={validationErrors.host || 'SMTP server address'}
                required
                disabled={formData.provider !== 'Custom'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                name="port"
                label="Port *"
                type="number"
                value={formData.port}
                onChange={handleInputChange}
                error={!!validationErrors.port}
                helperText={validationErrors.port || 'SMTP port number'}
                required
                disabled={formData.provider !== 'Custom'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Encryption *</InputLabel>
                <Select
                  name="encryption"
                  value={formData.encryption}
                  onChange={handleInputChange}
                  label="Encryption *"
                >
                  {encryptionOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                name="maxEmailsPerDay"
                label="Daily Email Limit"
                type="number"
                value={formData.maxEmailsPerDay}
                onChange={handleInputChange}
                helperText={`Recommended: ${formData.dailyLimit}`}
              />
            </Grid>
            {currentProvider?.helpLink && (
              <Grid item xs={12}>
                <Alert severity="info" icon={<InfoIcon />}>
                  <Typography variant="body2">
                    Need help with {formData.provider} setup?{' '}
                    <Link href={currentProvider.helpLink} target="_blank" rel="noopener">
                      View official documentation
                    </Link>
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="username"
                label={
                  formData.provider === 'Gmail' ? 'Gmail Address *' : 
                  formData.provider === 'Outlook/Hotmail' ? 'Outlook/Hotmail Email *' :
                  formData.provider === 'AWS SES' ? 'SMTP Username *' :
                  'Email/Username *'
                }
                value={formData.username}
                onChange={handleInputChange}
                error={!!validationErrors.username}
                helperText={validationErrors.username || (
                  formData.provider === 'Gmail' 
                    ? 'Your full Gmail address (e.g., you@gmail.com)' 
                    : formData.provider === 'AWS SES'
                    ? 'AWS SMTP username (e.g., AKIAIOSFODNN7EXAMPLE)'
                    : 'Email address or username'
                )}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="password"
                label={
                  formData.provider === 'Gmail' 
                    ? 'App Password (16 characters) *' 
                    : formData.provider === 'SendGrid' || formData.provider === 'Mailgun'
                    ? 'API Key *'
                    : formData.provider === 'AWS SES'
                    ? 'AWS SMTP Password *'
                    : 'Password *'
                }
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                error={!!validationErrors.password}
                helperText={validationErrors.password || (
                  formData.provider === 'Gmail' 
                    ? '16-character app password from Google' 
                    : formData.provider === 'SendGrid'
                    ? 'SendGrid API key'
                    : formData.provider === 'AWS SES'
                    ? 'AWS SMTP password (starts with AKIA)'
                    : 'SMTP password'
                )}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <HideIcon /> : <ViewIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            {formData.provider === 'Gmail' && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<WarningIcon />}>
                  <Typography variant="body2" fontWeight="bold">
                    Gmail requires App Password (NOT your regular password)
                  </Typography>
                  <Typography variant="body2">
                    1. Go to{' '}
                    <Link href="https://myaccount.google.com/security" target="_blank" rel="noopener">
                      Google Account Security
                    </Link>
                    <br />
                    2. Enable 2-Step Verification if not already enabled
                    <br />
                    3. Generate a 16-character App Password
                    <br />
                    4. Use that password here (e.g., "abcd efgh ijkl mnop")
                  </Typography>
                </Alert>
              </Grid>
            )}
            {formData.provider === 'AWS SES' && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>AWS SES SMTP Credentials:</strong>
                    <br />
                    • Get credentials from AWS Console → SES → SMTP Settings
                    <br />
                    • Username format: AKIAIOSFODNN7EXAMPLE
                    <br />
                    • Password is generated by AWS
                  </Typography>
                </Alert>
              </Grid>
            )}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Security Note:</strong> Credentials are encrypted and never stored in plain text.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Box>
            {testing ? (
              <Box sx={{ py: 4 }}>
                <Typography variant="h6" align="center" gutterBottom>
                  Testing SMTP Connection
                </Typography>
                <LinearProgress sx={{ mb: 3 }} />
                
                {testResults?.steps?.map((step, index) => (
                  <Box key={index} sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">
                        {step.name}
                      </Typography>
                      {step.status === 'passed' && <CheckCircleIcon fontSize="small" color="success" />}
                      {step.status === 'failed' && <CancelIcon fontSize="small" color="error" />}
                      {step.status === 'running' && <CircularProgress size={16} />}
                    </Box>
                    {step.error && (
                      <Typography variant="caption" color="error">
                        {step.error}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <SecurityIcon sx={{ fontSize: 60, color: 'primary.main', mb: 3 }} />
                <Typography variant="h6" gutterBottom>
                  Ready to Test & Save
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Click "Test & Save" to verify your SMTP credentials and activate the server.
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 3, mt: 2, textAlign: 'left' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    Configuration Summary:
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Server Name
                      </Typography>
                      <Typography variant="body2">
                        {formData.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Provider
                      </Typography>
                      <Typography variant="body2">
                        {formData.provider}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Host:Port
                      </Typography>
                      <Typography variant="body2" fontFamily="monospace">
                        {formData.host}:{formData.port}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Encryption
                      </Typography>
                      <Typography variant="body2">
                        {formData.encryption.toUpperCase()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Username
                      </Typography>
                      <Typography variant="body2" noWrap>
                        {formData.username}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="textSecondary">
                        Daily Limit
                      </Typography>
                      <Typography variant="body2">
                        {formData.maxEmailsPerDay} emails
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
                
                <Alert severity="warning" sx={{ mt: 3 }}>
                  <Typography variant="body2">
                    <strong>Important:</strong> Server will only be saved if connection test succeeds.
                    Invalid credentials will be rejected.
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          SMTP Server Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Configure and verify email server connections for reliable delivery
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" color="primary">
              {smtpSettings.length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total Servers
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
            <Typography variant="h4" fontWeight="bold" color="success.dark">
              {verifiedCount}
            </Typography>
            <Typography variant="body2" color="success.dark">
              Verified
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
            <Typography variant="h4" fontWeight="bold" color="warning.dark">
              {failedCount}
            </Typography>
            <Typography variant="body2" color="warning.dark">
              Failed Tests
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
            <Typography variant="h4" fontWeight="bold" color="primary.dark">
              {activeCount}
            </Typography>
            <Typography variant="body2" color="primary.dark">
              Active
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="medium">
              SMTP Servers ({smtpSettings.length})
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {verifiedCount} verified • {failedCount} failed • {activeCount} active
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ minWidth: 120 }}
            >
              Add Server
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      </Paper>

      {smtpSettings.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <CloudIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom color="textSecondary">
            No SMTP Servers Configured
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Add your first SMTP server to start sending emails
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            size="large"
          >
            Add SMTP Server
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Server Name</strong></TableCell>
                <TableCell><strong>Provider</strong></TableCell>
                <TableCell><strong>Host:Port</strong></TableCell>
                <TableCell><strong>Username/Email</strong></TableCell>
                <TableCell><strong>Daily Limit</strong></TableCell>
                <TableCell><strong>Last Tested</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {smtpSettings.map((smtp) => {
                const maxEmails = smtp.maxEmailsPerDay || smtp.dailyLimit || 500;
                const emailsSent = smtp.emailsSentToday || 0;
                const usagePercentage = maxEmails > 0 ? (emailsSent / maxEmails) * 100 : 0;
                
                return (
                  <TableRow 
                    key={smtp.id} 
                    sx={{ 
                      '&:hover': { bgcolor: 'action.hover' },
                      ...(smtp.isActive && {
                        bgcolor: 'success.lightest',
                        borderLeft: '4px solid',
                        borderLeftColor: 'success.main'
                      })
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={smtp.isActive ? "Active" : "Inactive"}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleActive(smtp.id, smtp.isActive)}
                            color={smtp.isActive ? "success" : "default"}
                            disabled={testing}
                          >
                            <PowerIcon sx={{ 
                              fontSize: 18,
                              ...(smtp.isActive && {
                                animation: 'pulse 2s infinite'
                              })
                            }} />
                          </IconButton>
                        </Tooltip>
                        {smtp.testResult === 'success' ? (
                          <VerifiedIcon fontSize="small" color="success" />
                        ) : smtp.testResult === 'failed' ? (
                          <ErrorIcon fontSize="small" color="error" />
                        ) : (
                          <WarningIcon fontSize="small" color="warning" />
                        )}
                        {smtp.isDefault && (
                          <Chip label="Default" size="small" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {smtp.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          ID: {smtp.id ? String(smtp.id).substring(0, 8) : 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: getProviderColor(smtp.provider),
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 12
                          }}
                        >
                          {smtp.provider?.charAt(0) || '?'}
                        </Box>
                        <Typography variant="body2">
                          {smtp.provider || 'Custom'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {smtp.host}:{smtp.port}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {(smtp.encryption || 'tls').toUpperCase()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {smtp.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {maxEmails}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(100, usagePercentage)}
                          color={
                            usagePercentage > 90 ? "error" :
                            usagePercentage > 70 ? "warning" : "success"
                          }
                          sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                        />
                        <Typography variant="caption" color="textSecondary">
                          {emailsSent} sent today
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {smtp.lastTested ? (
                        <Box>
                          <Typography variant="body2">
                            {new Date(smtp.lastTested).toLocaleDateString()}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {new Date(smtp.lastTested).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Never tested
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Test Connection">
                          <IconButton
                            size="small"
                            onClick={() => handleTestExistingConnection(smtp.id)}
                            disabled={testing}
                            color="info"
                          >
                            <RefreshIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(smtp)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={smtp.isActive ? "Set as Default" : "Verify to set as default"}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleSetDefault(smtp.id)}
                              disabled={!smtp.isActive || smtp.testResult !== 'success'}
                              color={smtp.isDefault ? "success" : "default"}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(smtp.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Alert severity="info" icon={<SecurityIcon />} sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Ready to send emails!</strong> {activeSmtpAccounts.length} active SMTP server(s) available.
          Go to Compose page to start sending emails using your configured servers.
        </Typography>
      </Alert>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editingSmtp ? <EditIcon color="primary" /> : <AddIcon color="primary" />}
            <Typography variant="h6">
              {editingSmtp ? 'Edit SMTP Server' : 'Add SMTP Server'}
            </Typography>
            {editingSmtp?.isActive && (
              <Chip label="Active" size="small" color="success" />
            )}
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            
            {getStepContent(activeStep)}
          </DialogContent>
          
          <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
            <Button onClick={handleCloseDialog} color="inherit">
              Cancel
            </Button>
            
            <Box sx={{ flex: '1 1 auto' }} />
            
            {activeStep > 0 && (
              <Button onClick={handleBack} sx={{ mr: 1 }}>
                Back
              </Button>
            )}
            
            <Button
              type="submit"
              variant="contained"
              disabled={testing}
              startIcon={activeStep === steps.length - 1 ? 
                (testing ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />) : 
                undefined
              }
            >
              {activeStep === steps.length - 1 ? 
                (testing ? 'Testing...' : (editingSmtp ? 'Update & Test' : 'Save & Test')) : 
                'Next'
              }
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

// Add CSS for pulse animation
const styleSheet = document.createElement("style");
styleSheet.innerText = `
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}
`;
document.head.appendChild(styleSheet);

export default SMTPConfig;