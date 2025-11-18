import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
} from '@mui/material';

const Header = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/voice-clone', label: '语音克隆' },
    { path: '/lip-sync', label: '唇形同步' },
    { path: '/chat', label: '实时对话' },
    { path: '/training', label: '训练管理' },
  ];

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          数字人Web端
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              color="inherit"
              variant={location.pathname === item.path ? 'outlined' : 'text'}
            >
              {item.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;

