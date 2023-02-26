/*
-Author: Mason Otto
-Name: server.js
-Last Modified: 2/6/2023
-Description: This is the backend API that includes all of the endpoints for communication
    between the front end and database.
*/

/*-------------------------------------------------------------------
    Import dependencies
-------------------------------------------------------------------*/
const mysql = require('mysql'); //used to interact with mysql databases
require('dotenv').config(); //dotenv for use with npm, protects sensitive information
const express = require('express'); //node package used to create backend server and api.
const nodemailer = require('nodemailer'); //node package used for sending emails
const cors = require('cors'); //needed to prevent cors error
const crypto = require('crypto');
const bcrypt = require("bcryptjs"); //used for hashing and encrypting data

const passportLocal = require("passport-local").Strategy;
const passport = require("passport");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const SALT = 10; //salt for hashing
const ALGORITHM = "aes-256-cbc"; //algorithm for encryption
const inVecString = [0x9f, 0x32, 0x11, 0xc9, 0x44, 0x3c, 0x5a, 0x34, 0x08, 0xac, 0x0e, 0x6d, 0xcc, 0xb7, 0x5a, 0x83];
const secKeyString = [0x40 ,0xda ,0x60 ,0x0b ,0xde ,0x7c ,0x4c ,0xb0 ,0x45 ,0x81 ,0xbe ,0x6e ,0xdf ,0x4b ,0x4b ,0xb4 ,0x63 ,0xe9 ,0xd6 ,0x1f ,0x35 ,0xcc ,0x76 ,0x0c ,0xc8 ,0xa5 ,0xb7 ,0x62 ,0x35 ,0xcf ,0xd2 ,0x37];
const INVEC = Buffer.from(inVecString, 'utf-8');
const SECKEY = Buffer.from(secKeyString, 'utf-8');

/*-------------------------------------------------------------------
    Constants
-------------------------------------------------------------------*/
const app = express(); //creates the app express.js object which handles requests
const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\s).{8,32}$/;
const emailRegex = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;

/*-------------------------------------------------------------------
    Configure Express.js

    Express.js handles GET, POST, PUT, etc... requests to the
    backend, and does so through the app object via the corresponding
    methods. When making a request through the app object, you
    include a callback function with a request and response object.
    The request object includes any data that the user provides which
    may be relevant to a query. The response object handles the response
    which is returned to the client, which in our case is usually parsed
    JSON data which can be used as a javascript object.

    Ex:

    app.post("/", (req, res) => {
        const username = req.body.username;
    });

    This would handle a post request to the "/" or base directory
    and would assign username information provided by the user to
    the variable username.
-------------------------------------------------------------------*/
app.use(express.json());
app.use(express.urlencoded({ extended: true })); //need this for auth

/*-------------------------------------------------------------------
    Configure CORS (Cross-Origin Resource Sharing)

    This is middleware for Express.js, it determines what origin's
    to accept requests from by setting the Access-Control-Allow-Origin
    header in the response. This is currently set to "*" for
    purposes of development, to allow requests from any origin.
-------------------------------------------------------------------*/
app.use(cors({
    credentials: true,
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], //temporary for development, this will eventually be the server where our app is hosted
}));

//the following 9 lines of code are used to create an express session and authenticate with passport
app.use(session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
}));
app.use(cookieParser(process.env.SECRET));
app.use(passport.initialize());
app.use(passport.session());
require('./passportConfig')(passport);

/*-------------------------------------------------------------------
    Database connection

    Connects to mysql using protected credentials stored in
    .env file
-------------------------------------------------------------------*/
const connection = mysql.createConnection({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    port: process.env.RDS_PORT
});

/*-------------------------------------------------------------------
    Functions
-------------------------------------------------------------------*/
//this uses nodemailer to send a email from truckmanagerservice@gmail.com
async function mail(email, otp) {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: 'truckmanagerservice@gmail.com',
        to: email,
        subject: 'Reset Password Request OTP',
        html: `<p>Your One Time Pin is <b>${otp}</b>. Use this to reset your password.<p>`
    }

    let info = await transporter.sendMail(mailOptions, (error, info) => {
        if(error) {console.log(error);}
        else {
            console.log("Email Sent!");
        }
    });
}

/*-------------------------------------------------------------------
    Backend Endpoints

    These include GET, POST, PUT, etc... requests that send
    information to or retrieve information from the database.
    This is the meat of the backend.
-------------------------------------------------------------------*/
app.get("/", (req, res) => {
    res.json("hello this is the backend");
});

//returns all invoices tables
app.get("/invoices", (req, res) => {
    if(!req.isAuthenticated()) {
        return res.json({authenticated: false});
    }
    const q = "SELECT * FROM accounting.load_tickets_test";
    //const q = "SELECT * FROM accounting.load_tickets";
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

/*
-Original Author: Mason Otto

-Last Modified: Ryan Penrod
-Changes: Updated uses of username with employee ID
*/
//this endpoint will check if a given employeeId is present in the database
app.get("/validemployeeid/:employeeid", (req, res) => {
    const employeeId = req.params.employeeid;
    const q = `SELECT Employee_ID FROM Login.Login WHERE Employee_ID = "${employeeId}" `;
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        if(result[0]) {
            return res.json({response: true});
        }
        else {
            return res.json({response: false});
        }
    })
})

/*
-Author: Mason Otto
-Description: This will set an OTP in the SQL database for the user that requested
    it. Then it will send that OTP to the email that user has stored in
    the database.
-Returns: JSON response - status of email sent
-TODO: Give OTP an expiration.


-Modified: 2/1/2023 -Mason Otto
-Recent Modifications: Added email decryption

-Last Modified: 2/15/2023 - Ryan Penrod
-Changes: Updated uses of username with employee ID
*/
app.put("/requestotp", (req, res) => {
    const employeeId = req.body.employeeId;
    const OTP = Math.floor(100000 + Math.random() * 900000);
    const q = `SELECT Email FROM Login.Login WHERE Employee_ID = "${employeeId}" `;
    const q2 = `UPDATE Login.Login SET OTP = ${OTP} WHERE Employee_ID = "${employeeId}"`;
    connection.query(q2, (err, result) => {
        if(err) return res.json(err);
        connection.query(q, (err, result) => {
            if(err) return res.json(err);
            if(result[0]) {
                const decipherText = crypto.createDecipheriv(ALGORITHM, SECKEY, INVEC);
                let decryptedEmail = decipherText.update(result[0].Email, "hex", "utf-8");
                decryptedEmail += decipherText.final("utf8");
                console.log(decryptedEmail);
                mail(decryptedEmail, OTP);
                return res.json({response: "EMAIL SENT", email: decryptedEmail});
            }
            else {
                return res.json({response: "EMAIL FAILED"});
            }
        });
    });

})

/*
-Author: Mason Otto
-Description: This will take in the user input OTP and their employeeId to verify if the OTP is correct.
    If correct then it will allow the user to update their password.
-Returns: JSON response - status of OTP verification
-TODO: Figure out some way to determine if OTP has expired.

-Modified: 1/23/2023 - Mason Otto

-Last Modified: 2/15/2023 - Ryan Penrod
-Changes: Updated uses of username with employee ID
*/
app.put("/verifyotp", (req, res) => {
    const employeeId = req.body.employeeId;
    const OTP = parseInt(req.body.otp);
    const q = `SELECT OTP FROM Login.Login WHERE Employee_ID = "${employeeId}"`;
    connection.query(q, (err, result) => {
        if(err) return res.json(err);
        if(result[0]) {
            if (OTP === parseInt(result[0].OTP)) {
                return res.json({response: "VERIFIED"});
            }
            else {
                return res.json({response: "FAILED"});
            }
        }
        else {
            return res.json({response: "FAILED"});
        }
    });
})

//This will update the password in the database with the given employeeId and new password
//NEED TO ENCRYPT PASSWORDS IN FUTURE
/*
-Original Author: Mason Otto

-Last Modified: 2/15/2023 - Ryan Penrod
-Changes: Updated uses of username with employee ID
*/
app.put("/forgotpassword", async (req, res) => {
    const employeeId = req.body.employeeId;
    const newPassword = req.body.newPassword;
    if(!passwordRegex.test(newPassword)) {
        return res.json({response: false, errcode: 1}) //password does not meet requirements
    }
    const hashedPassword = await bcrypt.hash(newPassword, SALT);
    const q = `UPDATE Login.Login SET Passcode = "${hashedPassword}" WHERE Employee_ID = "${employeeId}"`;
    connection.query(q, (err, result) => {
        if (err) return res.json({response: false, errcode: 2}); //failed to update to database
        return res.json({response: true, errcode: 0}); //successful password change
    });
})

//posts new data into database
//TODO: figure out what to do with "null" values
app.post("/invoices", (req, res) => {
    if(!req.isAuthenticated()) {
        return res.json({authenticated: false})
    }
    const q = "INSERT INTO accounting.load_tickets_test (`ticket_number`,`customer`,`date`,`description`,`order`,`job`,`driver_id`,`truck_number`,`hours`,`tons`,`rate`,`driver_rate`) VALUES (?)";
    const values = [
        req.body.ticketNum,
        "null",
        req.body.date,
        req.body.description,
        req.body.orderNum,
        "null",
        req.body.driver,
        req.body.truckNum,
        req.body.hours,
        req.body.tons,
        req.body.unitPrice,
        0
    ];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json({created: true, authenticated: true});
    });
});

/*
    Author: Mason Otto
    Created: 2/9/2023
    Description: This is where admin users will be able to add new employees
    
    Modified: 2/9/2023 - Mason Otto

    Last Modified: 2/15/2023 - Ryan Penrod
    Changes: Updated uses of username with employee ID
*/
app.post("/newemployee", (req, res) => {
    const uuid = crypto.randomUUID(); //this will generate a random 36 character long UUID
    const id = uuid;
    const employeeId = req.body.employeeId;
    const firstName = req.body.firstName;
    const lastName  = req.body.lastName;
    const accountType = req.body.accountType;
    const name = firstName + " " + lastName;

    const q = "INSERT INTO Login.Login (`id`,`Employee_ID`,`Passcode`,`Email`,`Name`, `OTP`,`Verified`,`Account_Type`) VALUES (?)";
    const values = [
        uuid,
        employeeId,
        null,
        null,
        name,
        "null",
        0,
        accountType,
    ];
    connection.query(q, [values], (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.json({message: "FAILED"});
        }
        const date = new Date();
        const values = [
            uuid,
            employeeId,
            date,
        ]
        const q2 = "INSERT INTO UserData.UserData (`id`, `Employee_ID`, `Creation_Date`) VALUES (?)";
        connection.query(q2, [values], (err, result, fields) => {
            if (err) {
                console.log(err);
                return res.json({message: "FAILED"});
            }
        });
        return res.json({message: "CREATED", employeeId: employeeId, name: name});
    });

})

/*
    Author: Mason Otto
    Created: 2/9/2023
    Last Modified: 2/26/2023
    Modified By: Mason Ott
    Modifications: Added checking for fields to be proper length and that zipcode and phone number only contain numbers
    Description: This is where users will be able update their info for their user profile
*/
app.put("/updateuser", (req, res) => {
    const state = req.body.state;
    const city = req.body.city;
    const street = req.body.street;
    const zipcode = req.body.zipcode;
    const phone = req.body.phone;

    if(!req.isAuthenticated()) {
        return res.json({authenticated: false});
    }
    //makes sure fields are of required length
    if(state.length != 2 || phone.length != 10 || zipcode.length != 5 || street.length === 0 || city.length === 0) {
        console.log("here")
        return res.json({message: "FAILED"});
    }
    
    //makes sure zipcode and phone number only contain numbers
    const numbersOnlyRegex = /^[0-9]*$/;
    if(!numbersOnlyRegex.test(zipcode) || !numbersOnlyRegex.test(phone)) {
        return res.json({message: "FAILED"});
    }

    const q = `UPDATE UserData.UserData SET State = "${state}", City = "${city}", Street = "${street}", Zipcode = "${zipcode}", Phone ="${phone}", New = "false" WHERE id = '${req.user.id}'`
    connection.query(q, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.json({message: "FAILED"});
        }
        return res.json({message: "UPDATED"});
    })
})

/*
    Author: Mason Otto
    Created: 2/19/2023
    Last Modified: 2/19/2023
    Description: This is the endpoint to be hit when requesting the users data from UserData table
*/
app.get("/userdata", async (req, res) => {
    if(!req.isAuthenticated()) return res.json({authenticated: false});

    const q = `SELECT State, City, Street, Zipcode, Creation_Date, Phone FROM UserData.UserData WHERE id = '${req.user.id}'`;
    connection.query(q, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.json({message: "FAILED"});
        }
        const q2 = `SELECT Email, Name FROM Login.Login WHERE id = '${req.user.id}'`;
        connection.query(q2, (err, result2, fields2) => {
            if (err) {
                console.log(err);
                return res.json({message: "FAILED"});
            }
            //TODO: decrypt email
            const decipherText = crypto.createDecipheriv(ALGORITHM, SECKEY, INVEC);
            let decryptedEmail = decipherText.update(result2[0].Email, "hex", "utf-8");
            decryptedEmail += decipherText.final("utf8");
            return res.json({
                message: "SUCCESS",
                state: result[0].State, 
                street: result[0].Street, 
                city: result[0].City,
                zipcode: result[0].Zipcode, 
                phone: result[0].Phone,
                email: decryptedEmail,
                name: result2[0].Name,
                employeeId: req.user.employeeId,
                hireDate: result[0].Creation_Date,
            });
        })
    })
})

/*
-Author: Ryan Penrod

<--- MODIFICATIONS --->
    2/8/2023 - Ryan Penrod
        Modifications: Updated to include first and last name after modifying table and
            frontend

    2/9/2023 - Mason Otto
        Recent Modifications: added regex for email and password format
        -Description: This create a new row on the Login table
            for a user given the information they provided
        -Returns: JSON response - status account creation

-TODO: Consider all fields
       Need to set up error handling for if a uuid is already in the database. -MO
*/
app.put("/register", async (req, res) => {
    //checks to make sure email is proper format
    if (!emailRegex.test(req.body.email)) {
        return res.json({message: "email"});
    }
    //checks to make sure password is proper format
    if (!passwordRegex.test(req.body.passcode)) {
        return res.json({message: "password"});
    }

    //The following statement will hash the passcode
    const hashedPassword = await bcrypt.hash(req.body.passcode, SALT);

    //The following will encrypt the email
    const cipherText = crypto.createCipheriv(ALGORITHM, SECKEY, INVEC);
    let encryptedEmail = cipherText.update(req.body.email, "utf-8", "hex");
    encryptedEmail += cipherText.final("hex");

    const q = `UPDATE Login.Login SET Passcode = "${hashedPassword}", Email = "${encryptedEmail}" WHERE Employee_ID = "${req.body.employeeId}"`
    connection.query(q, (err, result, fields) => {
        if (err) {
            console.log(err);
            return res.json({message: "FAILED"});
        }
        return res.json({message: "CREATED"});
    });
});

app.get("/loginData", (req, res) => {
    const q = "SELECT * FROM Login.Login;"; //retrieves every entry in login table
    connection.query(q, (err, result) => {
        if (err) return res.json(err);
        return res.json(result);
    });
});

/*
-Author: Mason Otto
-Description: Endpoint for login, this takes an employeeId and password and will authenticate that user,
    a cookie is stored in the browser for future authentication with passport
-Returns: JSON with a response message, accepted, and id of user authenticated
-TODO: test further for error handling

-Modified: 2/5/2023 - Mason Otto
Recent Modifications: Added passport functionality to verifying login

-Last Modified 2/15/2023 - Ryan Penrod
-Changes: updated uses of username with employee ID
*/
app.post("/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err){
            throw err;
        } 
        if (!user){
            res.json({response: 'invalid credentials', accepted: false});
        }
        else {
          req.login(user, (err) => {
            if (err) throw err;
            res.json({response: 'valid credentials', accepted: true, id: req.user.Employee_ID});
        });
        }
      })(req, res, next);
});

//creates new row in Login table
//req will be used to input query data once we have this connected to our front end
//for testing purposes we are using hardcoded values, sprint 6 will connect this to the front end
app.post("/logintest", (req, res) => {
    const q = "INSERT INTO Login.Login(`Employee_ID`, `Username`, `Passcode`, `Email`) VALUES (?)";
    const values = [1111, "test", "testpassword", "test@test.com"];
    connection.query(q, [values], (err, result, fields) => {
        if (err) return res.json(err);
        return res.json("User created successfully!");
    });
});

/*
-Author: Mason Otto
-Last Modified: 2/5/2023 - Mason Otto
-Description: This returns the user that made the request
-Returns: user
-TODO:
*/
app.get("/user", (req, res) => {
    res.json({user: req.user, authenticated: req.isAuthenticated()}); // The req.user stores the entire user that has been authenticated inside of it.
    console.log('User', req.user);
    console.log('Authenticated', req.isAuthenticated());
});


/*-------------------------------------------------------------------
    Start server

    Start server and listen for requests on port 5000
    (localhost:5000 - worth noting this is not always the same
    as the url which npm generates, but is always the correct url
    for Thunder Client). When the server is successfully started, log
    message "connected to backend!" to console.
-------------------------------------------------------------------*/
app.listen(5000, () =>{
    console.log("connected to backend!");
});
