import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import ShoppingBasketIcon from '@mui/icons-material/ShoppingBasket';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { useAuth } from '@/auth/AuthContext';
import { fetchUserProfile } from '@/api/users';
import { fetchSavedDeals } from '@/api/deals';
import ErrorState from '@/components/common/ErrorState';
import FullScreenLoader from '@/components/common/FullScreenLoader';

const ProfileHubPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: fetchUserProfile,
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });

  const savedDealsQuery = useQuery({
    queryKey: ['saved-deals'],
    queryFn: fetchSavedDeals,
    enabled: Boolean(user),
  });

  const profile = profileQuery.data?.data ?? user;
  const savedDealsCount = savedDealsQuery.data?.data?.length ?? 0;

  if (!user) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="h6">You are not signed in.</Typography>
      </Box>
    );
  }

  if (profileQuery.isLoading && !profile) {
    return <FullScreenLoader message="Loading your profile…" />;
  }

  if (profileQuery.isError || profileQuery.data?.error) {
    return (
      <ErrorState
        title="Unable to load profile"
        description="We couldn't load your DWIGO profile right now. Please retry."
        onRetry={() => profileQuery.refetch()}
      />
    );
  }

  return (
    <Stack spacing={3}>
      {/* Profile Header */}
      <Paper
        elevation={0}
        sx={{ p: 3, borderRadius: 4, border: (theme) => `1px solid ${theme.palette.divider}` }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
            {profile?.firstName?.charAt(0) ?? 'U'}
          </Avatar>
          <Box sx={{ flex: 1 }}>
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

      {/* Quick Actions */}
      <Stack spacing={2}>
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <CardActionArea onClick={() => navigate('/profile/deal-basket')}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <ShoppingBasketIcon color="primary" sx={{ fontSize: 32 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Deal Basket
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {savedDealsCount === 0
                      ? 'No saved deals yet'
                      : `${savedDealsCount} ${savedDealsCount === 1 ? 'deal' : 'deals'} saved`}
                  </Typography>
                </Box>
                <ArrowForwardIosIcon fontSize="small" color="action" />
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <CardActionArea onClick={() => navigate('/preferences')}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <TuneIcon color="primary" sx={{ fontSize: 32 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Preferences
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Customize your deal recommendations
                  </Typography>
                </Box>
                <ArrowForwardIosIcon fontSize="small" color="action" />
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>

        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}
        >
          <CardActionArea onClick={() => navigate('/profile/settings')}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Account Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage your account and privacy
                  </Typography>
                </Box>
                <ArrowForwardIosIcon fontSize="small" color="action" />
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      </Stack>

      <Button
        variant="text"
        color="error"
        startIcon={<LogoutIcon />}
        onClick={logout}
        sx={{ alignSelf: 'flex-start', mt: 2 }}
      >
        Sign out
      </Button>
    </Stack>
  );
};

export default ProfileHubPage;

