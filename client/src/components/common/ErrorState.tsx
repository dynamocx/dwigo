import { Box, Button, Typography } from '@mui/material';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
}

const ErrorState = ({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
  actionLabel = 'Retry',
}: ErrorStateProps) => (
  <Box
    sx={{
      py: 10,
      px: 2,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
    }}
  >
    <Typography variant="h6">{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
      {description}
    </Typography>
    {onRetry ? (
      <Button variant="contained" onClick={onRetry} sx={{ mt: 1 }}>
        {actionLabel}
      </Button>
    ) : null}
  </Box>
);

export default ErrorState;

