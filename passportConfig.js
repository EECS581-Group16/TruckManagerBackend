/*
-Author: Mason Otto
-Name: passportConfig.js
-Last Modified: 2/6/2023
-Description: config file for passport.js in server.js, defines local strategy,
  serializing users, and deserializing users.
*/

const localStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const mysql = require('mysql');
require('dotenv').config();
const SALT = 10;

//Database connection
const connection = mysql.createConnection({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  port: process.env.RDS_PORT 
});

/*
-Author: Mason Otto
-Last Modified: 2/5/2023
-Description: Local Strategy to be used for passport.js, this goes through and authenticates
  the user off of the credentials provided by the user.
-Returns: Object with user data
-TODO: test further (if needed)
*/
module.exports = function(passport) {
  passport.use("local",
    new localStrategy((username, password, done) => {
      connection.query(`SELECT Username, Passcode, id FROM Login.Login WHERE Username = "${username}"`, (error, results, fields) => {
        if (error) return done(error);
        if (results.length===0) return done(null, false);
        const isValid = bcrypt.compare(password, results[0].Passcode);
        user = {username: results[0].Username, id: results[0].id}
        if (isValid) {
          return done(null, user);
        }
        else {
          return done(null, false)
        }
      });
    })
  );

  //Description: this serializes the user and returns the user id associated with the user
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  //Description: this takes a user id and returns the username of the user and the id of that user
  //TODO: return name, and some other data once that is implemented elsewhere
  passport.deserializeUser((id, done) => {
    connection.query(`SELECT Username, id FROM Login.Login WHERE id = "${id}"`, (error, results) => {
      const userInformation = {
        username: results[0].Username,
        id: results[0].id
      }
      done(null, userInformation);
    });
  });
};