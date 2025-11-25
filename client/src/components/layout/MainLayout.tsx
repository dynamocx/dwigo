import { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  CircularProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { useLocation, PRESET_LOCATIONS } from '@/contexts/LocationContext';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

const MainLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedLocation, setSelectedLocation, useCurrentLocation, isLocating, locationError } =
    useLocation();
  const [locationMenuAnchor, setLocationMenuAnchor] = useState<null | HTMLElement>(null);

  const handleLocationClick = (event: React.MouseEvent<HTMLElement>) => {
    setLocationMenuAnchor(event.currentTarget);
  };

  const handleLocationClose = () => {
    setLocationMenuAnchor(null);
  };

  const handleSelectPresetLocation = (location: typeof PRESET_LOCATIONS[0]) => {
    setSelectedLocation(location);
    handleLocationClose();
  };

  const handleUseCurrentLocation = async () => {
    await useCurrentLocation();
    handleLocationClose();
  };

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
              onClick={handleLocationClick}
              disabled={isLocating}
              sx={{
                borderRadius: 999,
                borderColor: (theme) => theme.palette.divider,
                color: 'text.primary',
                textTransform: 'none',
                fontWeight: 600,
                px: 1.5,
                minWidth: 140,
              }}
            >
              {isLocating ? (
                <CircularProgress size={16} sx={{ mr: 1 }} />
              ) : (
                selectedLocation?.name || 'Select Location'
              )}
            </Button>
            <Menu
              anchorEl={locationMenuAnchor}
              open={Boolean(locationMenuAnchor)}
              onClose={handleLocationClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              <MenuItem onClick={handleUseCurrentLocation} disabled={isLocating}>
                <MyLocationIcon sx={{ mr: 1.5, fontSize: 20 }} />
                <Typography>Use My Location</Typography>
              </MenuItem>
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
                  Mid-Michigan Areas
                </Typography>
              </MenuItem>
              {PRESET_LOCATIONS.map((location) => (
                <MenuItem
                  key={location.id}
                  onClick={() => handleSelectPresetLocation(location)}
                  selected={selectedLocation?.id === location.id}
                >
                  <LocationOnOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} />
                  <Typography>{location.name}</Typography>
                </MenuItem>
              ))}
            </Menu>
            {locationError && (
              <Typography variant="caption" color="error" sx={{ position: 'absolute', top: 48, left: 16 }}>
                {locationError}
              </Typography>
            )}
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
            <IconButton
              color="primary"
              aria-label="deal basket"
              onClick={() => {
                if (!user) {
                  navigate('/register');
                } else {
                  navigate('/profile/deal-basket');
                }
              }}
              sx={{ width: 48, height: 48 }}
            >
              <ShoppingCartOutlinedIcon />
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

