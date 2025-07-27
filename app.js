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
    extended: false
}));

// Session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

app.use(flash());

// Setting up EJS
app.set('view engine', 'ejs');

// View all users
app.get('/', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            return res.status(500).send(err.toString());
        }
        res.render('users', { users: results, success: req.flash('success') });
    });
});

// Add user form
app.get('/addUser', (req, res) => {
    res.render('addusers', { messages: { success: req.flash('success') } });
});

// Handle new user submission
app.post('/addUser', (req, res) => {
    const { name, email, phone } = req.body;
    db.query('INSERT INTO users (name, email, phone) VALUES (?, ?, ?)', [name, email, phone], (err) => {
        if (err) {
            return res.status(500).send(err.toString());
        }
        req.flash('success', 'User added successfully');
        res.redirect('/addUser');
    });
});

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
            res.render('rates', {rate: results[0]});
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
            res.redirect('/');
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

app.post('/addRate', upload.single('image'), (req, res) => {
    //extract the rate data from the request body
    const {facility, availability, price} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = "noimage.png";
    }

    let availabilityValue = availability === 'on' ? 1 : 0;
    const sql = 'INSERT INTO rate (facility, availability, price_per_hour, image) VALUES (?, ?, ?, ?)';
    //insert the new rate into the database
    db.query( sql, [facility, availabilityValue, price, image], (error, results) => {
        if (error) {
            console.error('Error adding rate:', error.message);
            res.status(500).send('Error adding rates');
        } else {
            //if no rate with the given id is found, render a 404 page 
            res.redirect('/');
        }
    });
});

app.post('/editRate/:id', upload.single('image'), (req, res) => {
    //extract the product data from the request body
    const rateId = req.params.id;
    const {facility, availability, price} = req.body;
    let image = req.body.currentImage; //retrieve current image filename
    if (req.file) { // if new image is uploaded 
        image = req.file.filename; //set image to be new image filename
    }

    let availabilityValue = availability === 'on' ? 1 : 0;
    const sql = 'UPDATE rate SET facility = ?, availability = ?, price_per_hour = ?, image = ? WHERE rateId = ?';
    //insert the new product into the database
    db.query( sql, [facility, availabilityValue, price, image, rateId], (error, results) => {
        if (error) {
            console.error('Error updating rate:', error.message);
            res.status(500).send('Error updating rates');
        } else {
            //if no product with the given id is found, render a 404 page 
            res.redirect('/');
        }
    });
});

//end of rate route

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on URL address: http://localhost:${PORT}/`));
