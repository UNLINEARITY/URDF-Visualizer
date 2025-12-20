const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

// Use CORS to allow requests from the frontend development server
app.use(cors({
  origin: 'http://localhost:5173'
}));

// API endpoint to get the list of URDF files
app.get('/api/samples', (req, res) => {
  const publicDirPath = path.join(__dirname, '..', 'public');

  fs.readdir(publicDirPath, (err, files) => {
    if (err) {
      console.error('Failed to read public directory:', err);
      return res.status(500).json({ error: 'Failed to read directory' });
    }

    const urdfFiles = files.filter(file => file.endsWith('.urdf'));
    res.json(urdfFiles);
  });
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
