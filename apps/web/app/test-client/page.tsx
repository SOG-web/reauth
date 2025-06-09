'use client';
import { createReAuthClient } from '@/lib/reauth-client';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Example of creating a custom axios instance
const customAxiosInstance = axios.create({
  baseURL: 'http://localhost:3001',
  timeout: 5000,
});

customAxiosInstance.interceptors.request.use((config) => {
  console.log('Custom axios instance request interceptor:', config);
  return config;
});

const authClient = createReAuthClient({
  axiosInstance: customAxiosInstance,
  auth: {
    type: 'custom',
    getToken: () => {
      return '1234567890';
    },
  },
});

export default function TestClientPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Example of a global request interceptor
    const requestInterceptor = authClient.interceptors.request.use((config) => {
      console.log('Global request interceptor:', config);
      return config;
    });

    return () => {
      // Clean up the interceptor when the component unmounts
      authClient.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  const handleLogin = async () => {
    const { data, error } = await authClient.emailAuthPlugin.login(
      {
        email,
        password,
      },
      {
        onRequest: () => setMessage('Loading...'),
        onSuccess: (data: any) => {
          if (data.entity) {
            setMessage(
              data.transformedMessage ||
                `Login successful! Welcome, ${data.entity.email}.`,
            );
          }
        },
        onError: (error: any) => setMessage(`Login failed: ${error.message}`),
        interceptors: {
          response: (response: any) => {
            console.log('Per-request response interceptor:', response);
            if (response.data.data.success) {
              response.data.data.transformedMessage =
                'Login successful (transformed by interceptor)!';
            }
            return response;
          },
        },
      },
    );
  };

  const handleRegister = async () => {
    await authClient.emailAuthPlugin.register(
      {
        email,
        password,
      },
      {
        onRequest: () => setMessage('Loading...'),
        onSuccess: (data) =>
          setMessage(
            `Registration successful! Please check your email to verify.`,
          ),
        onError: (error) => setMessage(`Registration failed: ${error.message}`),
      },
    );
  };

  const handleCheckSession = async () => {
    // This is a placeholder for a real authenticated endpoint.
    // We'll assume one exists for this example.
    // const { data, error } = await authClient.some_plugin.some_authed_step({});
    setMessage('This is a placeholder for a real authenticated call.');
  };

  return (
    <div>
      <h1>ReAuth Client Test</h1>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button onClick={handleLogin}>Login</button>
        <button onClick={handleRegister}>Register</button>
        <button onClick={handleCheckSession}>Check Session</button>
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}
