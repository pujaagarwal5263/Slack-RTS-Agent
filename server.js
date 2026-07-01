require('dotenv').config();
const express = require('express');
const { setupRoutes } = require('./routes/route');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup routes
setupRoutes(app);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}`);
});
