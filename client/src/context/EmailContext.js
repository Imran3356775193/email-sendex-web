import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const EmailContext = createContext();

export const useEmail = () => {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmail must be used within EmailProvider');
  }
  return context;
};

export const EmailProvider = ({ children }) => {
  const { user } = useAuth();

  // Existing states...
  const [contacts, setContacts] = useState(() => {
    const saved = localStorage.getItem('contacts');
    return saved ? JSON.parse(saved) : [];
  });

  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem('templates');
    return saved ? JSON.parse(saved) : [];
  });

  const [smtpSettings, setSmtpSettings] = useState(() => {
    const saved = localStorage.getItem('smtpSettings');
    return saved ? JSON.parse(saved) : [];
  });

  const [emails, setEmails] = useState(() => {
    const saved = localStorage.getItem('emails');
    return saved ? JSON.parse(saved) : [];
  });

  // Add campaigns state
  const [campaigns, setCampaigns] = useState(() => {
    const saved = localStorage.getItem('campaigns');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState({
    sentToday: 0,
    sentTotal: 0,
    campaigns: 0,
    opened: 0,
    clicked: 0
  });

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('smtpSettings', JSON.stringify(smtpSettings));
  }, [smtpSettings]);

  // When user authenticates, load data from server
  useEffect(() => {
    const loadFromServer = async () => {
      if (!user || !user.token) return;

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` };
      try {
        const [contactsRes, templatesRes, smtpRes, emailsRes] = await Promise.all([
          fetch('/api/contacts', { headers }),
          fetch('/api/templates', { headers }),
          fetch('/api/smtp', { headers }),
          fetch('/api/email/recent', { headers })
        ]);

        if (contactsRes.ok) {
          const json = await contactsRes.json();
          if (json && json.contacts) setContacts(json.contacts);
        }

        if (templatesRes.ok) {
          const json = await templatesRes.json();
          if (json && json.templates) {
            const mapped = json.templates.map(t => ({
              ...t,
              content: t.htmlBody || t.body || ''
            }));
            setTemplates(mapped);
          }
        }

        if (smtpRes.ok) {
          const json = await smtpRes.json();
          if (json && json.smtp) setSmtpSettings(json.smtp);
        }

        if (emailsRes.ok) {
          const json = await emailsRes.json();
          if (json && json.emails) setEmails(json.emails);
        }
      } catch (err) {
        console.error('Failed to load server data:', err);
      }
    };

    loadFromServer();
  }, [user]);

  useEffect(() => {
    localStorage.setItem('emails', JSON.stringify(emails));
  }, [emails]);

  // Save campaigns to localStorage
  useEffect(() => {
    localStorage.setItem('campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  // Update stats including campaigns
  useEffect(() => {
    const today = new Date().toDateString();
    const sentToday = emails.filter(email => 
      new Date(email.sentAt).toDateString() === today
    ).length;
    
    const sentTotal = emails.length;
    
    // Calculate campaigns stats
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
    const pausedCampaigns = campaigns.filter(c => c.status === 'paused').length;
    
    // Calculate opens and clicks
    const opened = emails.reduce((sum, email) => sum + (email.opens || 0), 0);
    const clicked = emails.reduce((sum, email) => sum + (email.clicks || 0), 0);
    
    setStats({
      sentToday,
      sentTotal,
      campaigns: campaigns.length,
      activeCampaigns,
      completedCampaigns,
      pausedCampaigns,
      opened,
      clicked
    });
  }, [emails, campaigns]);

  // SMTP Helper Functions
  const getActiveSmtpAccounts = () => {
    return smtpSettings.filter(smtp => smtp.isActive && smtp.testResult === 'success');
  };

  const getDefaultSmtp = () => {
    const activeAccounts = getActiveSmtpAccounts();
    return activeAccounts.find(smtp => smtp.isDefault) || activeAccounts[0];
  };

  // SMTP Functions
  const addSmtpSetting = (smtpData) => {
    // Normalize provider names from UI to server enum values
    const mapProvider = (p) => {
      if (!p) return 'custom';
      const v = String(p).toLowerCase();
      if (v.includes('gmail')) return 'gmail';
      if (v.includes('outlook') || v.includes('hotmail')) return 'outlook';
      if (v.includes('yahoo')) return 'yahoo';
      if (v.includes('sendgrid')) return 'sendgrid';
      if (v.includes('amazon') || v.includes('aws') || v.includes('ses')) return 'amazon_ses';
      if (v.includes('mailgun')) return 'custom';
      return 'custom';
    };

    const payload = { ...smtpData, provider: mapProvider(smtpData.provider) };

    // If authenticated, save to server
    if (user && user.token) {
      return fetch('/api/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(payload)
      }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to add SMTP');
        setSmtpSettings(prev => [...prev, json.smtp]);
        return json.smtp;
      });
    }

    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newSmtp = {
      ...payload,
      id,
      created: new Date().toISOString(),
      emailsSentToday: 0,
      emailsSentTotal: 0
    };
    setSmtpSettings(prev => [...prev, newSmtp]);
    return newSmtp;
  };

  const updateSmtpSetting = (id, updates) => {
    setSmtpSettings(prev => {
      // If activating and setting as default, deactivate others
      if (updates.isActive && updates.isDefault) {
        return prev.map(smtp => {
          if (smtp.id === id) {
            return { ...smtp, ...updates };
          }
          return { 
            ...smtp, 
            isActive: false,
            isDefault: false 
          };
        });
      }
      
      // If just activating, ensure it's not default
      if (updates.isActive) {
        return prev.map(smtp => {
          if (smtp.id === id) {
            return { ...smtp, ...updates };
          }
          return smtp;
        });
      }
      
      // Regular update
      return prev.map(smtp => 
        smtp.id === id ? { ...smtp, ...updates } : smtp
      );
    });
  };

  const deleteSmtpSetting = (id) => {
    if (user && user.token) {
      fetch(`/api/smtp/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
        .then(async res => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Failed to delete');
          }
          setSmtpSettings(prev => prev.filter(smtp => smtp._id ? smtp._id !== id : smtp.id !== id));
        }).catch(err => toast.error(err.message));
      return;
    }

    setSmtpSettings(prev => prev.filter(smtp => smtp.id !== id));
  };

  const testSmtpConnection = async (smtpConfig) => {
    // Simulate SMTP connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Randomly fail for testing
    const shouldFail = Math.random() < 0.2;
    
    if (shouldFail) {
      throw new Error('Connection failed: Invalid credentials or network error');
    }
    
    return { success: true, message: 'Connection successful' };
  };

  // Campaign Functions
  const addCampaign = (campaignData) => {
    const id = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCampaign = {
      ...campaignData,
      id,
      created: new Date().toISOString(),
      progress: 0,
      sent: 0,
      failed: 0,
      opens: 0,
      clicks: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      status: campaignData.scheduleType === 'scheduled' ? 'scheduled' : 'active'
    };
    
    setCampaigns(prev => [...prev, newCampaign]);
    return newCampaign;
  };

  const updateCampaign = (campaignId, updates) => {
    setCampaigns(prev => 
      prev.map(campaign => 
        campaign.id === campaignId ? { ...campaign, ...updates } : campaign
      )
    );
  };

  const deleteCampaign = (campaignId) => {
    setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
  };

  const getCampaignById = (campaignId) => {
    return campaigns.find(campaign => campaign.id === campaignId);
  };

  const getCampaignStats = (campaignId) => {
    const campaign = getCampaignById(campaignId);
    if (!campaign) return null;
    
    const campaignEmails = emails.filter(email => email.campaignId === campaignId);
    
    return {
      totalEmails: campaignEmails.length,
      sent: campaignEmails.filter(e => e.status === 'sent').length,
      failed: campaignEmails.filter(e => e.status === 'failed').length,
      opens: campaignEmails.reduce((sum, email) => sum + (email.opens || 0), 0),
      clicks: campaignEmails.reduce((sum, email) => sum + (email.clicks || 0), 0),
      openRate: campaignEmails.length > 0 ? 
        (campaignEmails.reduce((sum, email) => sum + (email.opens || 0), 0) / campaignEmails.length) * 100 : 0,
      clickRate: campaignEmails.length > 0 ? 
        (campaignEmails.reduce((sum, email) => sum + (email.clicks || 0), 0) / campaignEmails.length) * 100 : 0,
      deliveryRate: campaignEmails.length > 0 ? 
        ((campaignEmails.filter(e => e.status === 'sent').length) / campaignEmails.length) * 100 : 0
    };
  };

  // Email Functions
  const addEmail = (emailData) => {
    const smtpUsed = smtpSettings.find(s => (s.id && s.id === emailData.smtpId) || (s._id && s._id === emailData.smtpId));
    const fromEmail = smtpUsed ? smtpUsed.username : emailData.fromEmail;
    const fromName = smtpUsed ? emailData.fromName || smtpUsed.displayName || fromEmail.split('@')[0] : emailData.fromName;
    
    const newEmail = {
      ...emailData,
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      sentAt: new Date().toISOString(),
      fromEmail,
      fromName,
      smtpId: emailData.smtpId,
      smtpProvider: smtpUsed?.provider || 'Simulation',
      status: 'sent',
      opens: 0,
      clicks: 0,
      trackingPixel: emailData.trackingEnabled && emailData.isHtml ? 
        `tracking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : null
    };

    setEmails(prev => [newEmail, ...prev]);
    
    // Update SMTP usage stats
    if (smtpUsed) {
      updateSmtpSetting(smtpUsed.id, {
        emailsSentToday: (smtpUsed.emailsSentToday || 0) + 1,
        emailsSentTotal: (smtpUsed.emailsSentTotal || 0) + 1,
        lastUsed: new Date().toISOString()
      });
    }
    
    return newEmail;
  };

  // If authenticated, fetch recent emails from server
  const fetchRecentEmails = async () => {
    if (!user || !user.token) return;
    try {
      const res = await fetch('/api/email/recent', { headers: { Authorization: `Bearer ${user.token}` } });
      const json = await res.json();
      if (res.ok && json.emails) setEmails(json.emails);
    } catch (err) {
      console.error('Failed to fetch recent emails', err);
    }
  };

  // Updated sendBulkEmails function to handle campaigns
  const sendBulkEmails = async (campaignData) => {
    const { contacts: recipientContacts, emailData: templateData, smtpId } = campaignData;
    const smtpUsed = smtpSettings.find(s => s.id === smtpId);
    
    if (!smtpUsed) {
      throw new Error('No active SMTP server selected');
    }

    if (recipientContacts.length === 0) {
      throw new Error('No contacts selected');
    }

    const campaignId = `campaign-${Date.now()}`;
    const sentEmails = [];
    let successfulSends = 0;
    let failedSends = 0;
    
    try {
      // Create campaign record
      const campaign = {
        id: campaignId,
        name: templateData.campaignName || `Campaign ${new Date().toLocaleDateString()}`,
        subject: templateData.subject,
        content: templateData.body,
        contacts: recipientContacts,
        totalContacts: recipientContacts.length,
        sent: 0,
        failed: 0,
        progress: 0,
        status: 'active',
        workers: templateData.workers || 4,
        emailsPerWorker: templateData.emailsPerWorker || 50,
        delayBetweenEmails: templateData.delayBetweenEmails || 5,
        retryAttempts: templateData.retryAttempts || 3,
        smtpStrategy: templateData.smtpStrategy || 'rotation',
        smtpId: smtpUsed.id,
        smtpProvider: smtpUsed.provider,
        trackingEnabled: templateData.trackingEnabled !== false,
        scheduleType: 'immediate',
        fromName: templateData.fromName || smtpUsed.displayName || smtpUsed.username.split('@')[0],
        fromEmail: templateData.fromEmail || smtpUsed.username,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };

      addCampaign(campaign);

      // Simulate sending emails (replace with actual SMTP sending)
      for (let i = 0; i < recipientContacts.length; i++) {
        const contact = recipientContacts[i];
        
        // Replace placeholders in template
        let processedBody = templateData.body;
        let processedSubject = templateData.subject;
        
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
        
        // Simulate sending (replace with actual SMTP call)
        const shouldFail = Math.random() < 0.05; // 5% failure rate for simulation
        const status = shouldFail ? 'failed' : 'sent';
        
        const sentEmail = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          to: [{ email: contact.email, name: `${contact.firstName} ${contact.lastName}`.trim() }],
          subject: processedSubject,
          body: processedBody,
          htmlBody: processedBody,
          isHtml: true,
          fromName: templateData.fromName || smtpUsed.displayName || smtpUsed.username.split('@')[0],
          fromEmail: templateData.fromEmail || smtpUsed.username,
          trackingEnabled: templateData.trackingEnabled !== false,
          sentAt: new Date().toISOString(),
          status: status,
          campaignId,
          smtpId: smtpUsed.id,
          smtpProvider: smtpUsed.provider,
          opens: 0,
          clicks: 0,
          recipients: 1
        };
        
        sentEmails.push(sentEmail);
        addEmail(sentEmail);
        
        if (status === 'sent') {
          successfulSends++;
        } else {
          failedSends++;
        }
        
        // Update campaign progress
        const progress = ((i + 1) / recipientContacts.length) * 100;
        updateCampaign(campaignId, {
          progress: progress,
          sent: successfulSends,
          failed: failedSends
        });
        
        // Simulate delay for realistic sending
        if (templateData.delayBetweenEmails && templateData.delayBetweenEmails > 0) {
          await new Promise(resolve => setTimeout(resolve, templateData.delayBetweenEmails * 1000));
        }
      }
      
      // Mark campaign as completed
      updateCampaign(campaignId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        progress: 100,
        sent: successfulSends,
        failed: failedSends,
        deliveryRate: (successfulSends / recipientContacts.length) * 100
      });
      
      return {
        success: true,
        campaignId,
        sentCount: successfulSends,
        failedCount: failedSends,
        smtpUsed: smtpUsed.provider,
        totalContacts: recipientContacts.length,
        deliveryRate: (successfulSends / recipientContacts.length) * 100
      };
      
    } catch (error) {
      // Update campaign with error status
      if (campaignId) {
        updateCampaign(campaignId, {
          status: 'stopped',
          stoppedAt: new Date().toISOString(),
          error: error.message
        });
      }
      
      return {
        success: false,
        error: error.message,
        sentCount: successfulSends,
        failedCount: failedSends
      };
    }
  };

  // Contact Functions
  const addContact = (contact) => {
    if (user && user.token) {
      return fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(contact)
      }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to add contact');
        setContacts(prev => [json.contact, ...prev]);
        return json.contact;
      });
    }

    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newContact = { ...contact, id, created: new Date().toISOString() };
    setContacts(prev => [...prev, newContact]);
    return newContact;
  };

  const updateContact = (id, updates) => {
    if (user && user.token) {
      fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(updates)
      }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Update failed');
        setContacts(prev => prev.map(c => (c._id === id || c.id === id) ? json.contact : c));
      }).catch(err => toast.error(err.message));
      return;
    }

    setContacts(prev => 
      prev.map(contact => 
        contact.id === id ? { ...contact, ...updates } : contact
      )
    );
  };

  const deleteContact = (id) => {
    if (user && user.token) {
      fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
        .then(async res => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Delete failed');
          }
          setContacts(prev => prev.filter(c => (c._id ? c._id !== id : c.id !== id)));
        }).catch(err => toast.error(err.message));
      return;
    }

    setContacts(prev => prev.filter(contact => contact.id !== id));
  };

  // Template Functions
  const addTemplate = (template) => {
    if (user && user.token) {
      const payload = {
        name: template.name,
        subject: template.subject,
        body: template.content,
        htmlBody: template.content,
        isHtml: true,
        category: template.category || 'general',
        isPublic: template.isPublic || false
      };

      return fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(payload)
      }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || (json.errors && json.errors.map(e=>e.msg).join(', ')) || 'Failed to add template');
        const mapped = { ...json.template, content: json.template.htmlBody || json.template.body || '' };
        setTemplates(prev => [mapped, ...prev]);
        return mapped;
      });
    }

    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newTemplate = { ...template, id, created: new Date().toISOString() };
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  };

  const updateTemplate = (id, updates) => {
    if (user && user.token) {
      fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({
          ...updates,
          body: updates.content || updates.body,
          htmlBody: updates.content || updates.htmlBody
        })
      }).then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Update failed');
        const mapped = { ...json.template, content: json.template.htmlBody || json.template.body || '' };
        setTemplates(prev => prev.map(t => (t._id === id || t.id === id) ? mapped : t));
      }).catch(err => toast.error(err.message));
      return;
    }

    setTemplates(prev => 
      prev.map(template => 
        template.id === id ? { ...template, ...updates } : template
      )
    );
  };

  const deleteTemplate = (id) => {
    if (user && user.token) {
      fetch(`/api/templates/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
        .then(async res => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || 'Delete failed');
          }
          setTemplates(prev => prev.filter(t => (t._id ? t._id !== id : t.id !== id)));
        }).catch(err => toast.error(err.message));
      return;
    }

    setTemplates(prev => prev.filter(template => template.id !== id));
  };

  // Utility Functions
  const clearAllHistory = () => {
    if (window.confirm('Are you sure you want to clear all email history? This cannot be undone.')) {
      setEmails([]);
      toast.success('All email history cleared');
    }
  };

  const getEmailStats = (emailId) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return null;
    
    return {
      opens: email.opens || 0,
      clicks: email.clicks || 0,
      openRate: email.opens ? (email.opens / email.recipients) * 100 : 0,
      clickRate: email.clicks ? (email.clicks / email.recipients) * 100 : 0,
      lastOpened: email.lastOpened,
      lastClicked: email.lastClicked
    };
  };

  const value = {
    // State
    contacts,
    templates,
    smtpSettings,
    emails,
    campaigns,
    stats,
    
    // SMTP Functions
    addSmtpSetting,
    updateSmtpSetting,
    deleteSmtpSetting,
    testSmtpConnection,
    getActiveSmtpAccounts, // Added
    getDefaultSmtp, // Added
    
    // Campaign Functions
    addCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaignById,
    getCampaignStats,
    sendBulkEmails,
    
    // Email Functions
    addEmail,
    clearAllHistory,
    getEmailStats,
    
    // Contact Functions
    addContact,
    updateContact,
    deleteContact,
    
    // Template Functions
    addTemplate,
    updateTemplate,
    deleteTemplate
  };

  return (
    <EmailContext.Provider value={value}>
      {children}
    </EmailContext.Provider>
  );
};