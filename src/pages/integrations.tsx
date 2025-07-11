import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/providers/AuthProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  HardDrive, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Loader2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Calendar,
  Users,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
// import AttendeeIntegration from '@/components/integrations/AttendeeIntegration';
import { ApiKeyStatus } from '@/lib/api-keys';
import PageHeader from '@/components/dashboard/PageHeader';

interface GoogleIntegrationStatus {
  connected: boolean;
  expiresAt?: string;
  email?: string;
  scopeMismatch?: boolean;
}

const IntegrationsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [googleStatus, setGoogleStatus] = useState<GoogleIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  // const [attendeeStatus, setAttendeeStatus] = useState<ApiKeyStatus | null>(null);
  const hasHandledCallback = useRef(false);

  // Check for OAuth callback parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const codeParam = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (errorParam) {
      setError(getErrorMessage(errorParam));
      setSuccess(null);
    } else if (codeParam && stateParam && !hasHandledCallback.current) {
      hasHandledCallback.current = true;
      setError(null);
      setSuccess(null);
      handleOAuthCallback(codeParam, stateParam);
    }
  }, [searchParams]);

  // Load Google integration status when user changes
  useEffect(() => {
    if (!authLoading && user?.id) {
      loadGoogleStatus();
      setPageLoading(false);
    } else if (!authLoading && !user?.id) {
      setPageLoading(false);
      setError('User session not found. Please log in again.');
    }
  }, [authLoading, user?.id]);

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'access_denied':
        return 'Google OAuth was denied. Please try again.';
      case 'invalid_request':
        return 'Invalid OAuth request. Please try again.';
      case 'server_error':
        return 'Google server error. Please try again later.';
      case 'temporarily_unavailable':
        return 'Google service temporarily unavailable. Please try again later.';
      default:
        return 'An unexpected error occurred during OAuth.';
    }
  };

  const loadGoogleStatus = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data: credentials, error } = await supabase
        .from('google_credentials')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }
      
      if (credentials) {
        // Check if stored scopes match current requested scopes
        const currentScopes = [
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/calendar'
        ].join(' ');
        
        function normalizeScopes(scopeString: string) {
          return scopeString
            .split(/\s+/)
            .filter(Boolean)
            .filter(scope => scope !== 'openid')
            .sort()
            .join(' ');
        }
        
        const normalizedStored = normalizeScopes(credentials.scope);
        const normalizedCurrent = normalizeScopes(currentScopes);
        const scopeMismatch = normalizedStored !== normalizedCurrent;
        
        setGoogleStatus({
          connected: true,
          expiresAt: credentials.expires_at,
          email: credentials.google_email,
          scopeMismatch
        });
      } else {
        setGoogleStatus({ connected: false });
      }
    } catch (error) {
      console.error('Error loading Google status:', error);
      setError('Failed to load Google integration status');
      setGoogleStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/integrations`;
    
    if (!clientId) {
      setError('Google OAuth client ID not configured');
      return;
    }

    // If user is already connected, disconnect first to clear old tokens
    if (googleStatus?.connected) {
      try {
        setConnecting(true);
        await handleGoogleDisconnect();
      } catch (error) {
        console.warn('Failed to disconnect before reconnecting:', error);
        // Continue anyway - the prompt=consent should handle scope updates
      } finally {
        setConnecting(false);
      }
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state: user.id
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = authUrl;
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    if (!user?.id || state !== user.id) {
      setError('Invalid OAuth callback');
      setSuccess(null);
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      setSuccess(null);

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // POST the code to the backend Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-google-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to exchange token');
        setSuccess(null);
        throw new Error(result.error || 'Failed to exchange token');
      }

      if (result.success) {
        setSuccess(`Successfully connected to Google account: ${result.email}`);
        setError(null);
        await loadGoogleStatus();
        // Automatically trigger initial sync and real-time sync
        try {
          await import('@/lib/calendar').then(async ({ calendarService }) => {
            await calendarService.initialSync();
            await calendarService.setupWebhookSync();
          });
        } catch (syncError) {
          // Optionally handle sync error (silent for now)
        }
        // Remove code/state from URL to prevent re-triggering
        navigate('/integrations', { replace: true });
      } else {
        setError(result.message || 'Failed to connect Google account');
        setSuccess(null);
        throw new Error(result.message || 'Failed to connect Google account');
      }
    } catch (error) {
      setError(error.message || 'Failed to complete OAuth process');
      setSuccess(null);
      console.error('OAuth callback error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!user?.id) return;

    try {
      setDisconnecting(true);
      setError(null);
      
      // Get current credentials for token revocation
      const { data: credentials } = await supabase
        .from('google_credentials')
        .select('access_token, refresh_token')
        .eq('user_id', user.id)
        .maybeSingle();

      // Revoke tokens at Google (if available)
      if (credentials?.access_token) {
        try {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: credentials.access_token }),
          });
        } catch (error) {
          console.warn('Could not revoke access token:', error);
        }
      }

      if (credentials?.refresh_token) {
        try {
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: credentials.refresh_token }),
          });
        } catch (error) {
          console.warn('Could not revoke refresh token:', error);
        }
      }

      // Delete credentials from database
      const { error: deleteError } = await supabase
        .from('google_credentials')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setGoogleStatus({ connected: false });
      setSuccess('Successfully disconnected from Google');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Disconnect error:', error);
      setError(error.message || 'Failed to disconnect from Google');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatExpiryDate = (expiresAt: string): string => {
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 flex-1 flex flex-col overflow-hidden font-mono">
      <PageHeader title={<span className="font-mono text-lg tracking-wide">INTEGRATIONS</span>} path="~/sunny.ai/integrations" />

      {/* Error Alert */}
      {error && (
        <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Scope Mismatch Warning */}
      {googleStatus?.connected && googleStatus?.scopeMismatch && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Scope Update Required:</strong> Your Google integration was connected with different permissions than currently requested. Click "RECONNECT" to update your permissions with the latest scopes.
          </AlertDescription>
        </Alert>
      )}

      {/* Google Integration Card */}
      <Card className="bg-white dark:bg-zinc-900 border border-[#4a5565] dark:border-zinc-700 mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <img src="https://www.gstatic.com/marketing-cms/assets/images/d5/dc/cfe9ce8b4425b410b49b7f2dd3f3/g.webp=s96-fcrop64=1,00000000ffffffff-rw" alt="Google Logo" className="w-7 h-7" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-mono">GOOGLE WORKSPACE</CardTitle>
                <CardDescription className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  Connect Gmail, Google Drive, and Calendar for comprehensive data integration
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {googleStatus?.connected ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 font-mono font-bold">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  CONNECTED
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 font-mono font-bold">
                  <XCircle className="w-3 h-3 mr-1" />
                  NOT CONNECTED
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Loading status...</span>
            </div>
          ) : connecting ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-sm">Connecting to Google...</span>
            </div>
          ) : googleStatus?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {googleStatus.email && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono">CONNECTED EMAIL</p>
                    <p className="text-sm font-mono">{googleStatus.email}</p>
                  </div>
                )}
                {googleStatus.expiresAt && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono">EXPIRES AT</p>
                    <p className="text-sm font-mono">{formatExpiryDate(googleStatus.expiresAt)}</p>
                  </div>
                )}
              </div>
              
              <Separator className="bg-[#4a5565] dark:bg-zinc-700" />
              
              <div className="space-y-3">
                <h4 className="text-sm font-bold font-mono">ACCESS PERMISSIONS</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-mono">Gmail (Read, Modify & Send)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-mono">Google Drive (Full Access)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-mono">Google Calendar (Full Access)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs font-mono">Google Account Email (userinfo.email)</span>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-xs text-blue-800 dark:text-blue-200 font-mono">
                    <span className="font-mono font-bold">Note:</span>
                    <span className="font-mono"> Only the above permissions are requested. If you've updated scopes in Google Cloud Console, click "RECONNECT" to refresh your permissions with the new scopes.</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleGoogleDisconnect}
                  disabled={disconnecting}
                  className="font-mono text-xs border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      DISCONNECTING...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      DISCONNECT
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGoogleConnect}
                  disabled={connecting}
                  className="font-mono text-xs border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      RECONNECTING...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      RECONNECT (UPDATE SCOPES)
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Button
                onClick={handleGoogleConnect}
                className="font-mono text-xs bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md shadow-md"
                size="lg"
              >
                <Mail className="mr-2 h-4 w-4" />
                CONNECT GOOGLE ACCOUNT
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendee Integration Card - Hidden for now, using master API key */}
      {/* <AttendeeIntegration onStatusChange={setAttendeeStatus} /> */}

      {/* Other Integrations */}
      <div className="mt-8">
        <h2 className="text-lg font-bold font-mono mb-4">COMING SOON</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="font-mono font-bold">OUTLOOK</CardTitle>
              <CardDescription className="font-mono">Microsoft 365 integration</CardDescription>
            </CardHeader>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="font-mono font-bold">DROPBOX</CardTitle>
              <CardDescription className="font-mono">File storage integration</CardDescription>
            </CardHeader>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="font-mono font-bold">SLACK</CardTitle>
              <CardDescription className="font-mono">Team communication integration</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage; 