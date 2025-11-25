import type { ReactNode } from 'react';

import LocalOfferIcon from '@mui/icons-material/LocalOfferOutlined';
import ExploreIcon from '@mui/icons-material/ExploreOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EmojiEventsIcon from '@mui/icons-material/EmojiEventsOutlined';
import AccountCircleIcon from '@mui/icons-material/AccountCircleOutlined';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';

interface NavItem {
  label: string;
  value: string;
  icon: ReactNode;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Deals', value: '/', icon: <LocalOfferIcon /> },
  { label: 'Explore', value: '/explore', icon: <ExploreIcon /> },
  { label: 'Agents', value: '/agent', icon: <AutoAwesomeIcon /> },
  { label: 'Rewards', value: '/rewards', icon: <EmojiEventsIcon /> },
  { label: 'Profile', value: '/profile', icon: <AccountCircleIcon />, requiresAuth: true },
];

const MobileBottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [value, setValue] = useState(location.pathname);

  const items = useMemo(
    () => NAV_ITEMS.filter((item) => (item.requiresAuth ? Boolean(user) : true)),
    [user]
  );

  useEffect(() => {
    // Highlight Profile during onboarding/preferences/register flow
    const isOnboardingFlow = ['/onboarding', '/preferences', '/register'].some((path) =>
      location.pathname.startsWith(path)
    );
    
    if (isOnboardingFlow) {
      setValue('/profile');
      return;
    }
    
    const activeItem = items.find((item) => location.pathname.startsWith(item.value));
    if (activeItem) {
      setValue(activeItem.value);
    }
  }, [items, location.pathname]);

  return (
    <Paper
      elevation={12}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        px: 1,
        pb: 1,
        maxWidth: '600px',
        mx: 'auto',
      }}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_, newValue) => {
          setValue(newValue);
          navigate(newValue);
        }}
        sx={{
          '& .MuiBottomNavigationAction-root': {
            color: 'text.secondary',
            '&.Mui-selected': {
              color: 'primary.main',
            },
          },
        }}
      >
        {items.map((item) => (
          <BottomNavigationAction key={item.value} value={item.value} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};

export default MobileBottomNav;

