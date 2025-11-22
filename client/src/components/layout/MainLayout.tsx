import { AppBar, Box, Button, Container, IconButton, Toolbar } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

const MainLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: (theme) => theme.palette.background.default,
      }}
    >
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          backgroundColor: '#ffffff',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Toolbar sx={{ minHeight: 64, gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/branding/DWIGO-LOGO-PIN.svg"
              alt="DWIGO"
              sx={{ height: 40, display: 'block' }}
            />
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LocationOnOutlinedIcon />}
              endIcon={<ExpandMoreIcon />}
              sx={{
                borderRadius: 999,
                borderColor: (theme) => theme.palette.divider,
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 600,
                px: 1.5,
              }}
            >
              San Francisco, CA
            </Button>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              color="primary"
              aria-label="open agents"
              onClick={() => navigate('/agent')}
              sx={{ width: 48, height: 48 }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 26 }} />
            </IconButton>
            {user ? (
              <IconButton color="primary" aria-label="notifications">
                <NotificationsNoneIcon />
              </IconButton>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, pb: 8 }}>
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Outlet />
        </Container>
      </Box>

      <MobileBottomNav />
    </Box>
  );
};

export default MainLayout;

