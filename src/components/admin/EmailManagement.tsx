'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, CheckCircle, XCircle, Send, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

interface EmailQueueItem {
  id: string;
  recipient_email: string;
  recipient_name: string;
  recipient_type: 'student' | 'parent';
  email_subject: string;
  scheduled_at: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message?: string;
  retry_count: number;
}

interface SessionEmailSettings {
  id: string;
  session_name: string;
  auto_email_results: boolean;
  email_delay_days: number;
  email_to_parents: boolean;
  email_to_students: boolean;
}

export default function EmailManagement() {
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([]);
  const [sessions, setSessions] = useState<SessionEmailSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadEmailData();
  }, []);

  const loadEmailData = async () => {
    try {
      setLoading(true);
      
      // Load email queue
      const { data: queueData, error: queueError } = await supabase
        .from('email_queue')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(100);
      
      if (queueError) throw queueError;
      setEmailQueue(queueData || []);
      
      // Load session email settings
      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .select('id, session_name, auto_email_results, email_delay_days, email_to_parents, email_to_students')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (sessionError) throw sessionError;
      setSessions(sessionData || []);
      
    } catch (error) {
      console.error('Error loading email data:', error);
      toast.error('Failed to load email data');
    } finally {
      setLoading(false);
    }
  };

  const updateSessionEmailSettings = async (sessionId: string, settings: Partial<SessionEmailSettings>) => {
    try {
      const { error } = await supabase
        .from('exam_sessions')
        .update(settings)
        .eq('id', sessionId);
      
      if (error) throw error;
      
      setSessions(sessions.map(s => 
        s.id === sessionId ? { ...s, ...settings } : s
      ));
      
      toast.success('Email settings updated');
    } catch (error) {
      console.error('Error updating email settings:', error);
      toast.error('Failed to update email settings');
    }
  };

  const processEmails = async () => {
    try {
      setProcessing(true);
      
      // Call your API endpoint to process emails
      const response = await fetch('/api/admin/process-emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`, // You'll need to add this
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to process emails');
      }
      
      const result = await response.json();
      toast.success(`Processed ${result.emailsSent} emails`);
      
      // Reload email queue
      loadEmailData();
      
    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error('Failed to process emails');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading email management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Mail className="w-6 h-6 mr-2" />
          Email Management
        </h2>
        <Button 
          onClick={processEmails} 
          disabled={processing}
          className="flex items-center"
        >
          {processing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Process Pending Emails
        </Button>
      </div>

      {/* Email Queue Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-yellow-500 mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {emailQueue.filter(e => e.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">
                  {emailQueue.filter(e => e.status === 'sent').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold">
                  {emailQueue.filter(e => e.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Mail className="w-5 h-5 text-blue-500 mr-2" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{emailQueue.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Session Email Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4">
                <h3 className="font-medium mb-4">{session.session_name}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={session.auto_email_results}
                      onCheckedChange={(checked) => 
                        updateSessionEmailSettings(session.id, { auto_email_results: checked })
                      }
                    />
                    <Label>Auto Email Results</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={session.email_to_students}
                      onCheckedChange={(checked) => 
                        updateSessionEmailSettings(session.id, { email_to_students: checked })
                      }
                    />
                    <Label>Email Students</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={session.email_to_parents}
                      onCheckedChange={(checked) => 
                        updateSessionEmailSettings(session.id, { email_to_parents: checked })
                      }
                    />
                    <Label>Email Parents</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Label>Delay (days):</Label>
                    <Input
                      type="number"
                      value={session.email_delay_days}
                      onChange={(e) => 
                        updateSessionEmailSettings(session.id, { 
                          email_delay_days: parseInt(e.target.value) || 0 
                        })
                      }
                      className="w-20"
                      min="0"
                      max="30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Email Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {emailQueue.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No emails in queue</p>
            ) : (
              emailQueue.map((email) => (
                <div key={email.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium">{email.recipient_name}</span>
                        <Badge variant="outline">{email.recipient_type}</Badge>
                        {getStatusBadge(email.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {email.recipient_email}
                      </p>
                      <p className="text-sm font-medium">{email.email_subject}</p>
                      <p className="text-xs text-muted-foreground">
                        Scheduled: {new Date(email.scheduled_at).toLocaleString()}
                        {email.sent_at && ` • Sent: ${new Date(email.sent_at).toLocaleString()}`}
                      </p>
                      {email.error_message && (
                        <p className="text-xs text-red-600 mt-1">
                          Error: {email.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
