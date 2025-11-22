import LocationOnIcon from '@mui/icons-material/LocationOn';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import { Avatar, Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthContext';
import { fetchUserProfile } from '@/api/users';
import ErrorState from '@/components/common/ErrorState';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchUserProfile,
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });

  const profile = profileQuery.data?.data ?? user;

  if (!user) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="h6">You are not signed in.</Typography>
      </Box>
    );
  }

  if (profileQuery.isLoading && !profile) {
    return (
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{ p: 3, borderRadius: 4, border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={64} height={64} />
            <Box>
              <Skeleton variant="text" width={180} height={28} />
              <Skeleton variant="text" width={220} height={20} />
            </Box>
          </Stack>
        </Paper>
        <Skeleton variant="rounded" height={164} />
        <Skeleton variant="rounded" height={164} />
      </Stack>
    );
  }

  if (profileQuery.isError || profileQuery.data?.error) {
    return (
      <ErrorState
        title="Unable to load profile"
        description="We couldn’t load your DWIGO profile right now. Please retry."
        onRetry={() => profileQuery.refetch()}
      />
    );
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
            {profile?.firstName.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {profile?.firstName} {profile?.lastName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile?.email}
            </Typography>
            {profile?.phone ? (
              <Typography variant="body2" color="text.secondary">
                {profile.phone}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <LocationOnIcon color="primary" />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Location sharing
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enable to get nudges when you are near curated deals or last-minute events.
              </Typography>
            </Box>
          </Stack>
          <Button variant="outlined" sx={{ alignSelf: 'flex-start' }}>
            Manage permissions
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={2} alignItems="center">
            <SettingsSuggestIcon color="primary" />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Connected channels
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add loyalty programs or travel accounts so DWIGO can sync your offers.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined">Link airline</Button>
            <Button variant="outlined">Link hotel</Button>
          </Stack>
        </Stack>
      </Paper>

      <Button
        variant="text"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={logout}
        sx={{ alignSelf: 'flex-start' }}
      >
        Sign out
      </Button>
    </Stack>
  );
};

export default ProfilePage;

