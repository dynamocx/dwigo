import type { ReactNode } from 'react';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';

interface RewardTileProps {
  title: string;
  description: string;
  icon: ReactNode;
}

const RewardTile = ({ title, description, icon }: RewardTileProps) => (
  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
    <Stack direction="row" spacing={2} alignItems="center">
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'rgba(25, 118, 210, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

const RewardsPage = () => (
  <Stack spacing={3}>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
        Rewards & Progress
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Rack up DWIGO points as you explore, redeem, and share deals. Unlock premium concierge perks for
        your next vacation.
      </Typography>
    </Box>

    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        color: '#ffffff',
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle2">Current tier</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Gold Explorer
        </Typography>
        <Typography variant="body2" sx={{ maxWidth: 320, opacity: 0.92 }}>
          Priority notifications, dedicated travel agent responses, and 2x points on family destinations.
        </Typography>
        <LinearProgress variant="determinate" value={65} sx={{ height: 8, borderRadius: 999 }} />
        <Typography variant="body2">650 / 1000 points to Platinum perks</Typography>
      </Stack>
    </Paper>

    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
        Ways to earn this week
      </Typography>
      <Stack spacing={1.5}>
        {[
          { label: 'Save 5 new deals', points: '+50 points' },
          { label: 'Redeem an in-store offer', points: '+120 points' },
          { label: 'Invite a friend to DWIGO', points: '+400 points' },
        ].map((task) => (
          <Paper
            key={task.label}
            elevation={0}
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: 3,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {task.label}
            </Typography>
            <Chip color="primary" label={task.points} size="small" />
          </Paper>
        ))}
      </Stack>
    </Box>

    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      <RewardTile
        title="Surprise & delight gifts"
        description="Unlock city-specific experiences and travel upgrades when you hit new streaks."
        icon={<CardGiftcardIcon />}
      />
      <RewardTile
        title="Household leaderboards"
        description="Friendly competition keeps the savings coming. Track family progress in one view."
        icon={<LeaderboardIcon />}
      />
      <RewardTile
        title="Brand multipliers"
        description="Earn double points when you shop at your top merchants and destinations."
        icon={<LoyaltyIcon />}
      />
      <RewardTile
        title="Platinum concierge"
        description="White-glove support for high-impact trips: group itineraries, once-in-a-lifetime events."
        icon={<EmojiEventsIcon />}
      />
    </Box>
  </Stack>
);

export default RewardsPage;

