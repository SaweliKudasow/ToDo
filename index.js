const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { pool, JWT_SECRET, PORT } = require('./server/config');
const createAuthRoutes = require('./server/routes/auth');
const createTodosRoutes = require('./server/routes/todos');

const app = express();
app.use(express.json());
app.use(createAuthRoutes({ pool, JWT_SECRET }));
app.use('/todos', createTodosRoutes({ pool, JWT_SECRET }));
app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
