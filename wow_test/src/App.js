import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  CircularProgress,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Grid,
  TextField,
  Chip,
  Tooltip
} from '@mui/material';
import axios from 'axios';
import './App.css';

// Create a Wowhead-inspired theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00B4FF', // Wowhead blue
    },
    secondary: {
      main: '#FFD700', // Wowhead gold
    },
    background: {
      default: '#1A1A1A', // Wowhead dark background
      paper: '#2D2D2D', // Wowhead card background
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B4B4B4',
    },
  },
  typography: {
    fontFamily: [
      'Open Sans',
      'Arial',
      'sans-serif',
    ].join(','),
    h3: {
      fontWeight: 600,
      fontSize: '2rem',
      color: '#00B4FF',
      borderBottom: '2px solid #00B4FF',
      paddingBottom: '0.5rem',
      marginBottom: '1.5rem',
    },
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(0, 180, 255, 0.1)',
          fontSize: '0.95rem',
          padding: '12px 16px',
        },
        head: {
          color: '#00B4FF',
          fontWeight: 600,
          backgroundColor: '#2D2D2D',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(0, 180, 255, 0.05)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& label.Mui-focused': {
            color: '#00B4FF',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          backgroundColor: '#00B4FF',
          '&:hover': {
            backgroundColor: '#0099E6',
          },
        },
      },
    },
  },
});

function App() {
  const [friends, setFriends] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [newServer, setNewServer] = useState('');
  const [friendData, setFriendData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Function to load tracked characters from file
  const loadTrackedCharacters = async () => {
    try {
      setInitialLoading(true);
      setError(null);
      
      const response = await fetch('/tracked_characters.txt');
      if (!response.ok) {
        throw new Error('Failed to load tracked characters file');
      }
      
      const text = await response.text();
      const lines = text.split('\n');
      
      // Filter out comments, empty lines, and duplicates
      const characters = [...new Set(
        lines
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.trim().toLowerCase())
      )]
      .map(line => {
        const [character, server] = line.split(',').map(s => s.trim());
        return { character, server };
      });

      // Collect all character data first
      const newFriends = [];
      const newFriendData = [];

      // Load data for each character
      for (const { character, server } of characters) {
        try {
          const data = await fetchFriendData(character, server);
          if (data) {
            newFriends.push(`${character}-${server}`);
            newFriendData.push(data);
          }
        } catch (err) {
          console.error(`Error loading character ${character}:`, err);
          // Continue with other characters even if one fails
        }
      }

      // Set all the data at once
      setFriends(newFriends);
      setFriendData(newFriendData);
    } catch (err) {
      console.error('Error loading tracked characters:', err);
      setError('Failed to load tracked characters. Please check the file format.');
    } finally {
      setInitialLoading(false);
    }
  };

  // Load tracked characters when component mounts
  useEffect(() => {
    loadTrackedCharacters();
  }, []);

  // Function to get access token
  const getAccessToken = async () => {
    try {
      console.log('Getting access token...');
      const response = await axios.post('https://oauth.battle.net/token', null, {
        params: {
          grant_type: 'client_credentials'
        },
        auth: {
          username: process.env.REACT_APP_BLIZZARD_CLIENT_ID,
          password: process.env.REACT_APP_BLIZZARD_CLIENT_SECRET
        }
      });
      console.log('Access token received');
      setAccessToken(response.data.access_token);
      return response.data.access_token;
    } catch (err) {
      console.error('Error getting access token:', err.response?.data || err.message);
      throw new Error(`Failed to authenticate with Blizzard API: ${err.response?.data?.error || err.message}`);
    }
  };

  // Function to fetch friend data
  const fetchFriendData = async (friendName, server) => {
    try {
      const token = accessToken || await getAccessToken();
      console.log('Using token:', token);
      
      // First, try to get the character's profile
      const profileResponse = await axios.get(
        `https://eu.api.blizzard.com/profile/wow/character/${server}/${friendName}?namespace=profile-eu&locale=en_GB`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      // Fetch character media
      const mediaResponse = await axios.get(
        `https://eu.api.blizzard.com/profile/wow/character/${server}/${friendName}/character-media?namespace=profile-eu&locale=en_GB`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('Profile API Response:', profileResponse.data);
      console.log('Media API Response:', mediaResponse.data);

      if (profileResponse.data) {
        // Get PvP summary
        const pvpResponse = await axios.get(
          `https://eu.api.blizzard.com/profile/wow/character/${server}/${friendName}/pvp-summary?namespace=profile-eu&locale=en_GB`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        console.log('PvP API Response:', pvpResponse.data);

        // Fetch detailed bracket information
        const bracketPromises = pvpResponse.data.brackets.map(async (bracket) => {
          const bracketType = bracket.href.split('/').pop().split('?')[0];
          console.log('Fetching bracket:', bracketType);
          try {
            const bracketResponse = await axios.get(
              `https://eu.api.blizzard.com/profile/wow/character/${server}/${friendName}/pvp-bracket/${bracketType}?namespace=profile-eu&locale=en_GB`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            );
            console.log(`Bracket ${bracketType} Response:`, bracketResponse.data);
            return {
              type: bracketType,
              data: bracketResponse.data
            };
          } catch (bracketErr) {
            console.error(`Error fetching bracket ${bracketType}:`, bracketErr.response?.data || bracketErr.message);
            return {
              type: bracketType,
              data: {
                rating: 0,
                season_match_statistics: {
                  played: 0,
                  won: 0,
                  lost: 0
                },
                season_round_statistics: {
                  played: 0,
                  won: 0,
                  lost: 0
                }
              }
            };
          }
        });

        const bracketResults = await Promise.all(bracketPromises);
        console.log('Bracket Results:', bracketResults);

        // Return a formatted entry with all bracket information and avatar
        const formattedData = {
          character: {
            name: profileResponse.data.name,
            realm: {
              slug: profileResponse.data.realm.slug
            },
            class: profileResponse.data.character_class.name,
            avatar: mediaResponse.data.assets.find(asset => asset.key === 'avatar')?.value || null
          },
          faction: {
            type: profileResponse.data.faction.name.toUpperCase()
          },
          brackets: bracketResults.map(result => {
            const isShuffle = result.type.includes('shuffle');
            console.log(`Processing ${result.type}:`, {
              isShuffle,
              matchStats: result.data.season_match_statistics,
              roundStats: result.data.season_round_statistics
            });
            
            const stats = isShuffle ? result.data.season_round_statistics : result.data.season_match_statistics;
            
            return {
              type: result.type,
              rating: result.data.rating || 0,
              statistics: {
                played: stats?.played || 0,
                won: stats?.won || 0,
                lost: stats?.lost || 0
              }
            };
          }),
          rank: 'N/A', // Not in leaderboard
        };

        console.log('Formatted Data:', formattedData);
        return formattedData;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching data for ${friendName}:`, err.message);
      if (err.response) {
        console.error('Error response:', err.response.data);
      }
      return null;
    }
  };

  // Function to add a friend
  const handleAddFriend = async () => {
    const characterName = newFriend.trim().toLowerCase();
    const serverName = newServer.trim().toLowerCase();
    const friendKey = `${characterName}-${serverName}`;
    
    if (characterName && serverName && !friends.includes(friendKey)) {
      setLoading(true);
      setError(null);
      const data = await fetchFriendData(characterName, serverName);
      
      if (data) {
        setFriends(prev => [...prev, friendKey]);
        setFriendData(prev => [...prev, data]);
        setNewFriend('');
        setNewServer('');
      } else {
        setError(`Could not find ${characterName} on ${serverName}`);
      }
      setLoading(false);
    }
  };

  // Function to remove a friend
  const handleRemoveFriend = (friendToRemove, index) => {
    setFriends(friends.filter(friend => friend !== friendToRemove));
    setFriendData(friendData.filter((_, i) => i !== index));
  };

  // Helper function to format stats for tooltip
  const formatStats = (stats) => {
    if (!stats) return 'No stats available';
    const winRate = stats.played ? ((stats.won / stats.played) * 100).toFixed(1) : '0.0';
    return `Wins: ${stats.won} | Losses: ${stats.lost} | Win Rate: ${winRate}%`;
  };

  // Format solo shuffle specs and ratings - show all specs
  const formatSoloRatings = (soloSpecs) => {
    if (!soloSpecs || soloSpecs.length === 0) return '0';
    
    // Map all specs, even if rating is 0
    return soloSpecs.map(spec => {
      const specName = spec.type.replace('shuffle-', '').split('-')[1];
      return `${specName.charAt(0).toUpperCase() + specName.slice(1)}: ${spec.rating}`;
    }).join(' | ');
  };

  // Format solo shuffle tooltip - show all specs
  const formatSoloTooltip = (soloSpecs) => {
    if (!soloSpecs || soloSpecs.length === 0) return 'No stats available';
    
    // Show stats for all specs
    return soloSpecs.map(spec => {
      const specName = spec.type.replace('shuffle-', '').split('-')[1];
      return `${specName.charAt(0).toUpperCase() + specName.slice(1)}:\n${formatStats(spec.statistics)}`;
    }).join('\n\n');
  };

  if (error) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Container>
          <Typography className="error-message" sx={{ color: '#ffd700', mt: 4 }}>
            {error}
          </Typography>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="App" style={{ 
        backgroundColor: '#1A1A1A', 
        minHeight: '100vh', 
        paddingTop: '2rem',
      }}>
        <Container maxWidth="lg" className="leaderboard-container">
          <Typography 
            variant="h3" 
            component="h1" 
            align="center" 
            sx={{ 
              mb: 4,
              fontWeight: 600,
            }}
          >
            Track Your Friends
          </Typography>

          {initialLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress sx={{ color: '#00B4FF' }} />
            </Box>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    alignItems: 'center', 
                    mb: 2,
                    backgroundColor: '#2D2D2D',
                    p: 2,
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 180, 255, 0.2)',
                  }}>
                    <TextField
                      label="Character name"
                      variant="outlined"
                      value={newFriend}
                      onChange={(e) => setNewFriend(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                      disabled={loading}
                      sx={{
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'rgba(0, 180, 255, 0.2)',
                          },
                          '&:hover fieldset': {
                            borderColor: '#00B4FF',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#00B4FF',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: '#B4B4B4',
                        },
                      }}
                    />
                    <TextField
                      label="Server"
                      variant="outlined"
                      value={newServer}
                      onChange={(e) => setNewServer(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                      disabled={loading}
                      sx={{
                        flexGrow: 1,
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': {
                            borderColor: 'rgba(0, 180, 255, 0.2)',
                          },
                          '&:hover fieldset': {
                            borderColor: '#00B4FF',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#00B4FF',
                          },
                        },
                        '& .MuiInputLabel-root': {
                          color: '#B4B4B4',
                        },
                      }}
                    />
                    <Chip
                      label={loading ? "Adding..." : "Add"}
                      onClick={handleAddFriend}
                      disabled={loading}
                      sx={{
                        backgroundColor: '#00B4FF',
                        color: '#FFFFFF',
                        fontWeight: 500,
                        padding: '12px 20px',
                        '&:hover': {
                          backgroundColor: '#0099E6',
                        },
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>

              {friendData.length > 0 && (
                <TableContainer 
                  component={Paper} 
                  sx={{ 
                    backgroundColor: '#2D2D2D',
                    borderRadius: '4px',
                    border: '1px solid rgba(0, 180, 255, 0.2)',
                    overflow: 'hidden',
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#00B4FF', fontWeight: 600 }}>#</TableCell>
                        <TableCell sx={{ color: '#00B4FF', fontWeight: 600 }}>Character</TableCell>
                        <TableCell sx={{ color: '#00B4FF', fontWeight: 600 }}>Class</TableCell>
                        <TableCell align="right" sx={{ color: '#00B4FF', fontWeight: 600 }}>Solo Ratings</TableCell>
                        <TableCell align="right" sx={{ color: '#00B4FF', fontWeight: 600 }}>2v2 Rating</TableCell>
                        <TableCell align="right" sx={{ color: '#00B4FF', fontWeight: 600 }}>3v3 Rating</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...friendData]
                        .sort((a, b) => {
                          const highestSoloRatingA = Math.max(
                            ...a.brackets
                              .filter(b => b.type.includes('shuffle'))
                              .map(b => b.rating || 0)
                          );
                          const highestSoloRatingB = Math.max(
                            ...b.brackets
                              .filter(b => b.type.includes('shuffle'))
                              .map(b => b.rating || 0)
                          );
                          return highestSoloRatingB - highestSoloRatingA;
                        })
                        .map((entry, friendIndex) => {
                          const soloData = entry.brackets
                            .filter(b => b.type.includes('shuffle'))
                            .sort((a, b) => b.rating - a.rating); // Sort by rating high to low
                          const twosData = entry.brackets.find(b => b.type === '2v2');
                          const threesData = entry.brackets.find(b => b.type === '3v3');

                          return (
                            <TableRow key={`${entry.character?.name || 'unknown'}-${entry.character?.realm?.slug || 'unknown'}`}>
                              <TableCell className="rank-cell">#{friendIndex + 1}</TableCell>
                              <TableCell>
                                <Box sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 2 
                                }}>
                                  {entry.character?.avatar && (
                                    <Box
                                      component="img"
                                      src={entry.character.avatar}
                                      alt={entry.character.name}
                                      sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        border: '2px solid rgba(0, 180, 255, 0.3)',
                                        boxShadow: '0 0 10px rgba(0, 180, 255, 0.2)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                          borderColor: '#00B4FF',
                                          boxShadow: '0 0 15px rgba(0, 180, 255, 0.4)',
                                          transform: 'scale(1.1)',
                                        }
                                      }}
                                    />
                                  )}
                                  <Typography>{entry.character?.name || 'Unknown'}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>{entry.character?.class || 'Unknown'}</TableCell>
                              <Tooltip 
                                title={formatSoloTooltip(soloData)} 
                                arrow 
                                placement="top"
                                componentsProps={{
                                  tooltip: {
                                    sx: {
                                      whiteSpace: 'pre-line'
                                    }
                                  }
                                }}
                              >
                                <TableCell align="right" className="rating-cell" sx={{ cursor: 'help' }}>
                                  {formatSoloRatings(soloData)}
                                </TableCell>
                              </Tooltip>
                              <Tooltip title={formatStats(twosData?.statistics)} arrow placement="top">
                                <TableCell align="right" className="rating-cell" sx={{ cursor: 'help' }}>
                                  {twosData?.rating || 0}
                                </TableCell>
                              </Tooltip>
                              <Tooltip title={formatStats(threesData?.statistics)} arrow placement="top">
                                <TableCell align="right" className="rating-cell" sx={{ cursor: 'help' }}>
                                  {threesData?.rating || 0}
                                </TableCell>
                              </Tooltip>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
