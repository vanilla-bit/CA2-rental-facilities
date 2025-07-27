const express = require('express');
const mysql = require('mysql2');

const session = require('express-session');

const flash = require('connect-flash');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'qsz825.h.filess.io',
    port: 61002,
    user: 'ca2rentalfacilities_shelflabor',
    password: '7f53d2a246632dddd36f9f81c6f77f4a4da72f9f',
    database: 'ca2rentalfacilities_shelflabor'
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//Session Middleware//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

//a Middleware to check if user is logged in//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

//a Middleware to check if user is admin//
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});


// a middleware function validateRegistration //
const validateRegistration = (req, res, next) => {
    const { username, email, password, role, contact } = req.body;

    if (!username || !email || !password || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};


//Integrating validateRegistration into the register route//
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, contact, role} = req.body;

    // Check if email or contact already exists
    const checkSql = 'SELECT * FROM users WHERE email = ? OR contact = ?';
    db.query(checkSql, [email, contact], (err, results) => {
        if (err) {
            throw err;
        }
        
        if (results.length > 0) {
            // Check which field is duplicate
            const emailExists = results.some(user => user.email === email);
            const contactExists = results.some(user => user.contact === contact);
            
            if (emailExists) {
                req.flash('error', 'Email address is already registered.');
            }
            if (contactExists) {
                req.flash('error', 'Contact number is already registered.');
            }
            
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        
        // If no duplicates, proceed with registration
        const insertSql = 'INSERT INTO users (username, email, password, contact, role) VALUES (?, ?, SHA1(?), ?, ?)';
        db.query(insertSql, [username, email, password, contact, role], (err, result) => {
            if (err) {
                throw err;
            }
            //console.log(result);
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    });
});
// login routes to render login page //
app.get('/login', (req, res) => {
    res.render('login', { 
        messages: req.flash('success'), 
        errors: req.flash('error') 
    });
});

//login routes for form submission below//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            //* redirect users to /dashboard route upon successful log in //
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password. Try changing password or registering again with a different email address if still does not work.');
            res.redirect('/login');
        }
    });
});

//To change password//
app.get('/change-password', (req, res) => {
    res.render('change-password', { 
        messages: req.flash('success'), 
        errors: req.flash('error') 
    });
});

app.post('/change-password', (req, res) => {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;

    console.log('Attempting password change for:', email); ////

    // Validation
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/change-password');
    }

    if (newPassword !== confirmPassword) {
        req.flash('error', 'New passwords do not match.');
        return res.redirect('/change-password');
    }

    if (newPassword.length < 6) {
        req.flash('error', 'New password must be at least 6 characters long.');
        return res.redirect('/change-password');
    }

    // Verify current credentials
    const verifySql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(verifySql, [email, currentPassword], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length === 0) {
            req.flash('error', 'Invalid email or current password. Update of password cannot be done.');
            return res.redirect('/change-password');
        }

        // Update password
        const updateSql = 'UPDATE users SET password = SHA1(?) WHERE email = ?';
        db.query(updateSql, [newPassword, email], (err, result) => {
            if (err) {
                throw err;
            }

            req.flash('success', 'Password changed successfully! Please log in with your new password.');
            res.redirect('/login');
        });
    });
});


// for dashboard route to render dashboard page for users.//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// code for admin route to render dashboard page for admin. //
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

//t code for logout route //
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port http://localhost:3000/');
});