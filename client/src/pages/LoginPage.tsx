import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';

import { useAuth } from '@/auth/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      const redirect = searchParams.get('redirect');
      navigate(redirect ?? '/', { replace: true });
    } catch (err: unknown) {
      setError('We could not sign you in. Check your details and try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack spacing={2} alignItems="center">
        <Box component="img" src="/branding/DWIGO-LOGO.svg" alt="DWIGO" sx={{ height: 48 }} />
        <Typography variant="caption" color="text.secondary">
          Deals Where I Go
        </Typography>
      </Stack>

      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Sign in to keep earning rewards and get DWIGO deals wherever you go.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2}>
        <TextField
          required
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <TextField
          required
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </Stack>

      <Button variant="contained" size="large" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <Typography variant="body2" color="text.secondary">
        New to DWIGO?{' '}
        <Link component="button" type="button" onClick={() => navigate('/register')}>
          Create an account
        </Link>
      </Typography>
    </Box>
  );
};

export default LoginPage;

