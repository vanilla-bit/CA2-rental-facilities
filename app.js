const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer=require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

const storage=multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, 'public/facilityimages');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname); 
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        }
});

const upload=multer({storage: storage});

// Database connection
const db = mysql.createConnection({
    host: 'qsz825.h.filess.io',
    port: '61002',
    user: 'ca2rentalfacilities_shelflabor',
    password: '7f53d2a246632dddd36f9f81c6f77f4a4da72f9f',
    database: 'ca2rentalfacilities_shelflabor' 
});

db.connect((err) => {
    if (err) {
console.error('Error connecting to MySQL:', err);
return;
}
console.log('Connected to MySQL database');
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({
    extended: true
}));

// Session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // Session expires after 1 week of inactivity
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

//User
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

//code for logout route //
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//End of User

//Facilities routes
app.get('/facility',(req,res) =>{
    const sql='SELECT * FROM facility';
    db.query(sql,(error,results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving facility');
        }
    
res.render('facilities', {
            facility: results,
            query: '',
            view: 'table',
            noResults: results.length === 0
        });

    })
})

app.get('/facility/search', (req, res) => {
  const searchQuery = req.query.query;
  const viewMode = req.query.view || 'table';

  const sql = 'SELECT * FROM facility WHERE name LIKE ? OR description LIKE ?';
  const likeQuery = `%${searchQuery}%`;

  db.query(sql, [likeQuery, likeQuery], (error, results) => {
    if (error) {
      console.error('Search query error:', error.message);
      return res.status(500).send('Error searching facilities');
    }

    const noResults = results.length === 0;
    res.render('facilities', {
      facility: results,
      query: searchQuery,
      view: viewMode,
      noResults: noResults
    });
  });
});


app.get('/facility/:id', (req,res) => {
    const facilityId=req.params.id;
    const sql = 'SELECT * FROM facility WHERE facilityId=?';
    db.query(sql,[facilityId],(error,results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving facility by ID');
        }
        if (results.length>0){
            res.render('facility', {facility: results[0]});
        } else {
            res.status(404).send('Facility not found');
        }
    })
})

app.get('/addFacility', (req,res) => {
    res.render('addFacility');
});

app.post('/addFacility', upload.single('image'), (req, res) => {
    const {name, description} =req.body;
    let image;
    if (req.file) {
        image=req.file.filename;
    } else {
        image="noImage.png";}
    const sql='INSERT INTO facility (name, description, image) VALUES (?,?,?)';
    db.query(sql, [name,description,image], (error,results) => {
        if (error) {
            console.error("Error adding facility:", error);
            res.status(500).send('Error adding facility');
        } else {
            res.redirect('/facility');
        }
    });
});

app.get('/editFacility/:id', (req,res) => {
    const facilityId=req.params.id;
    const sql = 'SELECT * FROM facility WHERE facilityId=?';
    db.query(sql,[facilityId],(error,results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving facility by ID');
        }
        if (results.length>0){
            res.render('editFacility', {facility: results[0]});
        } else {
            res.status(404).send('Facility not found');
        }
    });
});

app.post('/editFacility/:id', upload.single('image'), (req, res) => {
    const facilityId=req.params.id;
    const {name, description} =req.body;
    let image=req.body.currentImage;
    if (req.file) {image=req.file.filename;}
    const currentImage = req.body.currentImage
    if (currentImage && currentImage !== 'noImage.png') {
        const oldImagePath = path.join(__dirname, 'public', 'facilityimages', currentImage);
        fs.unlink(oldImagePath, (err) => {
            if (err) {
                console.error("Error deleting old image:", err);
            } else {
                console.log("Old image deleted:", currentImage);
            }
        });
    }

    const sql='UPDATE facility SET name=?, description=?, image=? WHERE facilityId=?';
    db.query(sql, [name,description,image,facilityId], (error,results) => {
        if (error) {
            console.error("Error updating facility:", error);
            res.status(500).send('Error updating facility');
        } else {
            res.redirect('/facility');
        }
    });
});

app.get('/deleteFacility/:id', (req, res) => {
    const facilityId = req.params.id;

    const sqlSelect = 'SELECT image FROM facility WHERE facilityId = ?';
    db.query(sqlSelect, [facilityId], (err, results) => {
        if (err || results.length === 0) {
            console.error("Error fetching facility image:", err);
            return res.status(500).send('Error fetching facility image');
        }

        const imageName = results[0].image;

        const sqlDelete = 'DELETE FROM facility WHERE facilityId = ?';
        db.query(sqlDelete, [facilityId], (error) => {
            if (error) {
                console.error("Error deleting facility:", error);
                return res.status(500).send('Error deleting facility');
            }

            if (imageName && imageName !== 'noImage.png') {
                const imagePath = path.join(__dirname, 'public', 'facilityimages', imageName);
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error("Error deleting image file:", err);
                    }
                });
            }

            res.redirect('/facility');
        });
    });
});
//End of facility routes

app.get('/rate',(req,res) =>{
    const sql='SELECT * FROM rate';
    db.query(sql,(error,results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving rate');
        }
    
res.render('rate', {
            rate: results,
            query: '',
            view: 'table',
            noResults: results.length === 0
        });

    })
})

app.get('/rate/search', (req, res) => {
  const searchQuery = req.query.query;
  const viewMode = req.query.view || 'table';

  const sql = 'SELECT * FROM rate WHERE facilityid LIKE ? OR week LIKE ? OR peak = ?';
  const likeQuery = `%${searchQuery}%`;

  db.query(sql, [likeQuery, likeQuery, searchQuery], (error, results) => {
    if (error) {
      console.error('Search query error:', error.message);
      return res.status(500).send('Error searching rates');
    }

    const noResults = results.length === 0;
    res.render('rate', {
      rate: results,
      query: searchQuery,
      view: viewMode,
      noResults: noResults
    });
  });
});

app.get('/rate/:id', (req, res) => {
    //extract the product id from the request parameters
    const rateId = req.params.id;
    const sql = 'SELECT *FROM rate WHERE rateId = ?';
    //Fetch data from MYsql based on product id
    db.query( sql, [rateId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving rates by ID');
        }
        //Check if any product with the given id was found
        if (results.length > 0) {
            //Render html page with the product data
            res.render('rate', {rate: results[0]});
        } else {
            //if no product with the given id is found, render a 404 page 
            res.status(404).send('Rate not found');
        }
    });
});

app.get('/addRate', (req, res) => {
    res.render('addRate');
});

app.get('/deleteRate/:id', (req, res) => {
    const rateId = req.params.id;
    const sql = 'DELETE FROM rate WHERE rateId = ?';
    //Fetch data from MYsql based on product id
    db.query( sql, [rateId], (error, results) => {
        if (error) {
            console.error('Error deleting rate:', error.message);
            return res.status(500).send('Error deleting rate');
        } else {
            //if no product with the given id is found, render a 404 page 
            res.redirect('/rate');
        }
    });
});

app.get('/editRate/:id', (req, res) => {
    const rateId = req.params.id;
    const sql = 'SELECT *FROM rate WHERE rateId = ?';
    //Fetch data from MYsql based on product id
    db.query( sql, [rateId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving rates by ID');
        }
        //Check if any product with the given id was found
        if (results.length > 0) {
            //Render html page with the product data
            res.render('editRate', {rate: results[0]});
        } else {
            //if no product with the given id is found, render a 404 page 
            res.status(404).send('Rate not found');
        }
    });
});

app.post('/addRate', (req, res) => {
    //extract the rate data from the request body
    const {facilityid, week, peak,  price} = req.body;
    const sql = 'INSERT INTO rate (facilityid, week, peak, price) VALUES (?, ?, ?, ?)';
    //insert the new rate into the database
    db.query( sql, [facilityid, week, peak, price], (error, results) => {
        if (error) {
            console.error('Error adding rate:', error.message);
            res.status(500).send('Error adding rates');
        } else {
            //if no rate with the given id is found, render a 404 page 
            res.redirect('/rate');
        }
    });
});

app.post('/editRate/:id', (req, res) => {
    //extract the product data from the request body
    const rateId = req.params.id;
    const {facilityid, week, peak, price} = req.body;
    const sql = 'UPDATE rate SET facilityid = ?, week = ?, peak = ?, price = ? WHERE rateId = ?';
    //insert the new product into the database
    db.query( sql, [facilityid, week, peak, price, rateId], (error, results) => {
        if (error) {
            console.error('Error updating rate:', error.message);
            res.status(500).send('Error updating rates');
        } else {
            //if no product with the given id is found, render a 404 page 
            res.redirect('/rate');
        }
    });
});

//end of rate route

//Start of Payment Route
// Routes created for features assigned to me
app.get('/payments', checkAuthenticated, (req, res) => {
    const user_id = req.params.id
    const sql = 'SELECT * FROM payments WHERE user_id = ?'
    db.query(sql , [user_id], (error, results) => {
        // Edit later to check existence of user_id in database and perform filtering
        if (error) throw error;

        if (results.length > 0) {
            res.render('payments', { user: req.session.user, payments: results });
        } else {
            res.status(404).send('No payments found for user');
        }
    }); 
});

app.get('/editPayment/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const payment_id = req.params.id;
    const sql = 'SELECT payment_date, payment_mode, payment_status FROM payments WHERE payment_id = ?';

    db.query(sql , [payment_id], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            res.render('editPayment', { payment: results[0] });
        } else {
            res.status(404).send('Payment not found');
        }
    });
});

app.post('/editPayment/:id', (req, res) => {
    const payment_id = req.params.id;
    const { payment_date, payment_mode, payment_status} = req.body;

    const sql = 'UPDATE payments SET payment_date = ?, payment_mode = ?, payment_status = ? WHERE payment_id = ?';
    db.query(sql, [payment_date, payment_mode, payment_status], (error, results) => {
        if (error) {
            console.error("Error updating payment:", error);
            res.status(500).send('Error updating payment');
        } else {
            res.redirect(' '); // Fill in with the route where admin should be redirected to
        }
    });
});
//End of Payment Routes
//booking
// Route to render booking form
app.get('/bookings', checkAuthenticated, (req, res) => {
    
    res.render('bookings', { formData: {}, messages: [], user: req.session.user    });
});

// Route to handle booking form submission
app.post('/bookings', checkAuthenticated, (req, res) => {
    const { username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost } = req.body;

    // Enhanced validation
    const errors = [];

    if (!username || !email || !contact || !facilities || !booking_date || !start_time || !end_time || !num_people || !total_cost) {
        errors.push('All fields are required');
    }

    if (!(email.includes('@') && email.includes('.') && email.indexOf('.') > email.indexOf('@') + 1)) {
    errors.push('Invalid email format');
    }

    if (!(contact.length === 8 && !isNaN(contact))) {
    errors.push('Contact number must be 8 digits');
    }  

    const bookingDate = new Date(booking_date);
    const today = new Date();
    if (bookingDate < today) {
        errors.push('Booking date cannot be in the past');
    }

    // Check if there are any validation errors
    if (errors.length > 0) {
        return res.render('bookings', { 
            formData: req.body, 
            messages: errors 
            , user: req.session.user
        });
    }

    // Sanitize inputs before DB insertion
    const sanitizedInputs = {
        username: username.trim(),
        email: email.toLowerCase().trim(),
        contact: contact.trim(),
        facilities: facilities.trim(),
        booking_date,
        start_time,
        end_time,
        num_people: parseInt(num_people),
        total_cost: parseFloat(total_cost)
    };

    const sql = `INSERT INTO bookings 
        (username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    connection.query(sql, Object.values(sanitizedInputs), (err, result) => {
        if (err) {
            console.error("Error inserting booking:", err);
            return res.render('bookings', { 
                formData: req.body, 
                messages: ['Database error. Please try again.'] ,
                user: req.session.user
            });
        }

        req.flash('success', 'Booking successful!');
        res.redirect('/listBooking');
    });
});

app.get('/booking/:id', checkAuthenticated, (req, res) => {
    const bookingId = req.params.id;

    connection.query('SELECT * FROM bookings WHERE bookingId = ?', [bookingId], (error, results) => {

        if (results.length > 0) {
            res.render('booking', { booking: results[0], user: req.session.user });
        } else {
            res.status(404).send('Booking not found');
        }
    });
});

app.get('/addBooking', checkAuthenticated, (req, res) => {
    res.render('addBooking', { user: req.session.user });
});

// Handle booking creation
app.post('/addBooking', (req, res) => {
    const { username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost } = req.body;

    const sql = `
        INSERT INTO bookings 
        (username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(sql, [username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost], (error) => {
        if (error) {
            console.error("Error adding booking:", error);
            res.status(500).send('Error adding booking');
        } else {
            res.redirect('/listBooking');
        }
    });
});


app.get('/listBooking', checkAuthenticated, (req, res) => {
    connection.query('SELECT * FROM bookings', (err, results) => {
        if (err) {
            req.flash('error', 'Error retrieving bookings');
            return res.redirect('/');
        }
        res.render('listBooking', { bookings: results, user: req.session.user });
    });
});


app.get('/editBooking/:id', checkAuthenticated, (req, res) => {
    connection.query('SELECT * FROM bookings WHERE id = ?', [req.params.id], (err, result) => {
        if (err || result.length === 0) {
            req.flash('error', 'Booking not found');
            return res.redirect('/listBooking');
        }
        res.render('editBooking', { booking: result[0], messages: [], user: req.session.user });
    });
});

app.post('/editBooking/:id', checkAuthenticated, (req, res) => {
    const { username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost } = req.body;
    const sql = `UPDATE bookings 
                SET username=?, email=?, contact=?, facilities=?, booking_date=?, start_time=?, end_time=?, num_people=?, total_cost=? 
                WHERE id=?`;

    const values = [username.trim(), email.toLowerCase().trim(), contact.trim(), facilities.trim(), booking_date, start_time, end_time, parseInt(num_people), parseFloat(total_cost), req.params.id];

    connection.query(sql, values, (err) => {
        if (err) {
            req.flash('error', 'Update failed');
            return res.redirect('/listBooking');
        }
        req.flash('success', 'Booking updated successfully');
        res.redirect('/listBooking');
    });
});

app.post('/cancelBooking/:id', checkAuthenticated, (req, res) => {
    connection.query('DELETE FROM bookings WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            req.flash('error', 'Failed to cancel booking');
        } else {
            req.flash('success', 'Booking cancelled');
        }
        res.redirect('/editBooking');
    });
});

app.post('/searchBookings', checkAuthenticated, (req, res) => {
    const { search_term } = req.body;
    const sql = `
        SELECT * FROM bookings 
        WHERE username = ? AND (facilities LIKE ? OR booking_date = ?)
    `;
    const values = [req.session.user.username, `%${search_term}%`, search_term];

    connection.query(sql, values, (err, results) => {
        if (err) {
            req.flash('error', 'Search failed');
            return res.redirect('/editBooking');
        }
        res.render('editBookings', { bookings: results, messages: [], user: req.session.user });
    });
});

app.get('/updateBooking/:id', checkAuthenticated, (req, res) => {
    const bookingId = req.params.id;

    connection.query('SELECT * FROM bookings WHERE bookingId = ?', [bookingId], (error, results) => {
        if (results.length > 0) {
            res.render('updateBooking', { booking: results[0] });
        } else {
            res.status(404).send('Booking not found');
        }
    });
});

// Handle booking update
app.post('/updateBooking/:id', (req, res) => {
    const bookingId = req.params.id;
    const { username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost } = req.body;

    const sql = `
        UPDATE bookings SET 
        username = ?, email = ?, contact = ?, facilities = ?, 
        booking_date = ?, start_time = ?, end_time = ?, num_people = ?, total_cost = ?
        WHERE bookingId = ?
    `;

    connection.query(sql, [username, email, contact, facilities, booking_date, start_time, end_time, num_people, total_cost, bookingId], (error) => {
        if (error) {
            console.error("Error updating booking:", error);
            res.status(500).send('Error updating booking');
        } else {
            res.redirect('/listBooking');
        }
    });
});

app.post('/cancelBooking/:id', checkAuthenticated, (req, res) => {
    const bookingId = req.params.id;
    const username = req.session.user.name;

    // Ensure the user only cancels their own bookings
    const sql = 'DELETE FROM bookings WHERE id = ? AND username = ?';
    connection.query(sql, [bookingId, username], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not cancel booking');
        } else {
            req.flash('success', 'Booking cancelled');
        }
        res.redirect('/bookings');
    });
});

// Example homepage route
app.get('/', (req, res) => {
    res.send('Welcome to the Booking System');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on URL address: http://localhost:${PORT}/`));
//end
