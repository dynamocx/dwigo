import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';

import { useAuth } from '@/auth/AuthContext';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dealId = (location.state as { dealId?: number })?.dealId;
  const redirectTo = (location.state as { redirectTo?: string })?.redirectTo;
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await register({ ...form });
      navigate('/onboarding', { 
        replace: true,
        state: { dealId, redirectTo }
      });
    } catch (err: unknown) {
      setError('Something went wrong creating your account. Please try again.');
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
          Create your DWIGO profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Share a few details so DWIGO Agent can personalise deals for your household.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            required
            label="First name"
            value={form.firstName}
            onChange={updateField('firstName')}
            sx={{ flex: 1 }}
          />
          <TextField
            required
            label="Last name"
            value={form.lastName}
            onChange={updateField('lastName')}
            sx={{ flex: 1 }}
          />
        </Stack>
        <TextField
          required
          label="Email"
          type="email"
          value={form.email}
          onChange={updateField('email')}
          autoComplete="email"
        />
        <TextField label="Mobile number" value={form.phone} onChange={updateField('phone')} autoComplete="tel" />
        <TextField
          required
          label="Password"
          type="password"
          value={form.password}
          onChange={updateField('password')}
          autoComplete="new-password"
        />
      </Stack>

      <Button variant="contained" size="large" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <Typography variant="body2" color="text.secondary">
        Already have an account?{' '}
        <Link component="button" type="button" onClick={() => navigate('/login')}>
          Sign in
        </Link>
      </Typography>
    </Box>
  );
};

export default RegisterPage;

