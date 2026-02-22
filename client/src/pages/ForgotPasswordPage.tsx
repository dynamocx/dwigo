import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';

import api from '@/api/client';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess(true);
    } catch (err: unknown) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 2.5 }}>
        <Stack spacing={2} alignItems="center">
          <Box component="img" src="/branding/DWIGO-LOGO.svg" alt="DWIGO" sx={{ height: 48 }} />
          <Typography variant="caption" color="text.secondary">
            Deals Where I Go
          </Typography>
        </Stack>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Check your email
        </Typography>
        <Typography variant="body2" color="text.secondary">
          If an account exists with that email, we sent a password reset link. It may take a few
          minutes to arrive. Check spam if you don’t see it.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          In development, the reset link may be printed in the server logs instead of sent by email.
        </Typography>
        <Button component={RouterLink} to="/login" variant="outlined" fullWidth>
          Back to sign in
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 2.5 }}>
      <Stack spacing={2} alignItems="center">
        <Box component="img" src="/branding/DWIGO-LOGO.svg" alt="DWIGO" sx={{ height: 48 }} />
        <Typography variant="caption" color="text.secondary">
          Deals Where I Go
        </Typography>
      </Stack>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Forgot password?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your email and we’ll send you a link to reset your password.
        </Typography>
      </Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        required
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        fullWidth
      />
      <Button variant="contained" size="large" type="submit" disabled={isSubmitting} fullWidth>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
      <Typography variant="body2" color="text.secondary">
        <Link component={RouterLink} to="/login">
          Back to sign in
        </Link>
      </Typography>
    </Box>
  );
};

export default ForgotPasswordPage;
