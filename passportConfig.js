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

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
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