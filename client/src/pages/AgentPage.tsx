import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { Avatar, Box, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

const PRESET_SUGGESTIONS = [
  'Plan a budget-friendly weekend in Austin',
  'Find golf experiences near Scottsdale',
  'Recommend family activities in Orlando',
  'Show me ski trip deals for Tahoe',
];

interface Message {
  id: number;
  author: 'agent' | 'user';
  text: string;
}

const AgentPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      author: 'agent',
      text: 'Hi! I am your DWIGO Agent. Tell me where you are headed or what you are into, and I will line up the best deals and experiences.',
    },
  ]);
  const [draft, setDraft] = useState('');

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), author: 'user', text },
      {
        id: Date.now() + 1,
        author: 'agent',
        text: 'Great choice! I am pulling together deals and recommendations tailored to that request.',
      },
    ]);
    setDraft('');
  };

  return (
    <Stack spacing={3} sx={{ minHeight: '70vh' }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          DWIGO Agents
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Your travel concierge that already knows your favorites, family habits, and bucket-list goals.
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          borderRadius: 4,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          background: '#ffffff',
          p: 2,
          minHeight: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.map((message) => (
          <Stack key={message.id} direction="row" spacing={2} alignItems="flex-start">
            {message.author === 'agent' ? (
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <AutoAwesomeIcon fontSize="small" />
              </Avatar>
            ) : (
              <Avatar sx={{ bgcolor: 'secondary.main' }}>Me</Avatar>
            )}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 3,
                bgcolor: message.author === 'agent' ? 'primary.light' : 'grey.100',
                color: message.author === 'agent' ? 'primary.contrastText' : 'text.primary',
                maxWidth: '80%',
              }}
            >
              <Typography variant="body2">{message.text}</Typography>
            </Box>
          </Stack>
        ))}
      </Paper>

      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">
          Try asking for…
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
          {PRESET_SUGGESTIONS.map((prompt) => (
            <Paper
              key={prompt}
              elevation={0}
              onClick={() => sendMessage(prompt)}
              sx={{
                px: 2,
                py: 1,
                borderRadius: 999,
                cursor: 'pointer',
                border: (theme) => `1px solid ${theme.palette.divider}`,
                background: 'transparent',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {prompt}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>

      <Paper
        component="form"
        elevation={0}
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(draft);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: 999,
          backgroundColor: '#ffffff',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          px: 2,
          py: 0.5,
        }}
      >
        <TextField
          variant="standard"
          fullWidth
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Where should we go next?"
          InputProps={{ disableUnderline: true }}
        />
        <IconButton color="primary" type="submit" aria-label="Send">
          <SendIcon />
        </IconButton>
      </Paper>
    </Stack>
  );
};

export default AgentPage;

