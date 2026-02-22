import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';

import api from '@/api/client';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!token) {
      setError('Invalid reset link. Request a new one from the forgot password page.');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Something went wrong. The link may have expired — request a new one.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Box component="img" src="/branding/DWIGO-LOGO.svg" alt="DWIGO" sx={{ height: 48 }} />
          <Typography variant="caption" color="text.secondary">
            Deals Where I Go
          </Typography>
        </Stack>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Password updated
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You can now sign in with your new password.
        </Typography>
        <Button component={RouterLink} to="/login" variant="contained" fullWidth>
          Sign in
        </Button>
      </Box>
    );
  }

  if (!token) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Stack spacing={2} alignItems="center">
          <Box component="img" src="/branding/DWIGO-LOGO.svg" alt="DWIGO" sx={{ height: 48 }} />
          <Typography variant="caption" color="text.secondary">
            Deals Where I Go
          </Typography>
        </Stack>
        <Alert severity="warning">
          This reset link is invalid or missing. Use the link from your email or{' '}
          <Link component={RouterLink} to="/forgot-password">
            request a new one
          </Link>
          .
        </Alert>
        <Button component={RouterLink} to="/login" variant="outlined" fullWidth>
          Back to sign in
        </Button>
      </Box>
    );
  }

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
          Set new password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your new password below.
        </Typography>
      </Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        required
        label="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        fullWidth
        inputProps={{ minLength: 6 }}
      />
      <TextField
        required
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        fullWidth
        inputProps={{ minLength: 6 }}
      />
      <Button variant="contained" size="large" type="submit" disabled={isSubmitting} fullWidth>
        {isSubmitting ? 'Updating…' : 'Update password'}
      </Button>
      <Typography variant="body2" color="text.secondary">
        <Link component={RouterLink} to="/login">
          Back to sign in
        </Link>
      </Typography>
    </Box>
  );
};

export default ResetPasswordPage;
