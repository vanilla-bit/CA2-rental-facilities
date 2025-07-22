const express = require('express');
const mysql = require('mysql2');

//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');
const flash = require('connect-flash')
const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'qsz825.h.filess.io',
    port:'61002',
    user: 'ca2rentalfacilities_shelflabor',
    password: '7f53d2a246632dddd36f9f81c6f77f4a4da72f9f',
    //database: 'ca2rentalfacilities' //
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** TODO: Insert code for *SESSION MIDDLEWARE* below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    ///Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');


// View all users
app.get('/', async (req, res) => {
  try {
    const [users] = db.query('SELECT * FROM Users');
    res.render('users', { users });
  } catch (err) {
    res.status(500).send(err.toString());
  }
});

// Add user form
app.get('/add', (req, res) => {
  res.render('addUser');
});

// Handle new user submission
app.post('/add', (req, res) => {
  const { name, email, phone } = req.body;
  try {
    db.query('INSERT INTO Users (name, email, phone) VALUES (?, ?, ?)', [name, email, phone]);
    res.redirect('/users');
  } catch (err) {
    res.status(500).send(err.toString());
  }

    req.flash('success', 'User added successfully');
    res.redirect('/users');

});



app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});