'use client';

import { useState } from 'react';
import { Button } from '@/lib/components/ui/button';
import { Input } from '@/lib/components/ui/input';
import { Label } from '@/lib/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/lib/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/lib/components/ui/tabs';
import { Alert, AlertDescription } from '@/lib/components/ui/alert';
import { Loader2 } from 'lucide-react';

type AuthResult = {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
  };
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuthResult | null>(null);

  // Email/Password form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Username/Password form
  const [username, setUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');

  const handleAuthRequest = async (plugin: string, step: string, data: any) => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/auth/${plugin}/${step}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: AuthResult = await response.json();
      setResult(result);
    } catch (error) {
      setResult({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to authentication service',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordLogin = () => {
    handleAuthRequest('email-password', 'login', {
      email,
      password,
    });
  };

  const handleEmailPasswordRegister = () => {
    handleAuthRequest('email-password', 'register', {
      email,
      password,
    });
  };

  const handleUsernameLogin = () => {
    handleAuthRequest('username-password', 'login', {
      username,
      password: userPassword,
    });
  };

  const handleUsernameRegister = () => {
    handleAuthRequest('username-password', 'register', {
      username,
      password: userPassword,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ReAuth Test Login</CardTitle>
          <CardDescription>
            Test authentication with username and email-password plugins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email + Password</TabsTrigger>
              <TabsTrigger value="username">Username + Password</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password123"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEmailPasswordLogin}
                  disabled={loading || !email || !password}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEmailPasswordRegister}
                  disabled={loading || !email || !password}
                  className="flex-1"
                >
                  Register
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="username" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPassword">Password</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="password123"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleUsernameLogin}
                  disabled={loading || !username || !userPassword}
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUsernameRegister}
                  disabled={loading || !username || !userPassword}
                  className="flex-1"
                >
                  Register
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {result && (
            <Alert className={`mt-4 ${result.success ? 'border-green-500' : 'border-red-500'}`}>
              <AlertDescription>
                <strong>{result.success ? 'Success:' : 'Error:'}</strong>
                {result.success ? (
                  <pre className="mt-2 text-xs overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                ) : (
                  <div className="mt-2">
                    <p><strong>Code:</strong> {result.error?.code}</p>
                    <p><strong>Message:</strong> {result.error?.message}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
