require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes')
const donorRoutes = require('./routes/donorRoutes')
const hospitalRoutes = require('./routes/hospitalRoutes')
const primeRoutes = require('./routes/primeRoutes')
const mlRoutes = require('./routes/mlRoutes')

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions)); 

app.use('/auth', authRoutes)
app.use('/donor', donorRoutes)
app.use('/hospital', hospitalRoutes)
app.use('/prime', primeRoutes)
app.use('/ml', mlRoutes)

const PORT = process.env.PORT || 5060;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});