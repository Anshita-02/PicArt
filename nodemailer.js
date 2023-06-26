const nodemailer = require("nodemailer");
const googleApis = require("googleapis");
require('dotenv').config();
const REDIRECT_URI = `https://developers.google.com/oauthplayground`;
const CLIENT_ID = process.env['NODEMAILER_CLIENT_ID'];
const CLIENT_SECRET = process.env['NODEMAILER_CLIENT_SECRET'];
const REFRESH_TOKEN = process.env['NODEMAILER_REFRESH_TOKEN'];
const authClient = new googleApis.google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);  
authClient.setCredentials({ refresh_token: REFRESH_TOKEN });

async function mailer(email, otp, userid) {
  try {
    const ACCESS_TOKEN = await authClient.getAccessToken();
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "anshitamethi732@gmail.com",
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken:REFRESH_TOKEN,
        accessToken: ACCESS_TOKEN,
      },
    });
    const details = {
      from: "Anshita Methi <anshitamethi732@gmail.com>",
      to: email,
      subject: "Reset PicArt Password",
      text: "message text",
      html: `<a href = 'http://localhost:3000/forgot/${userid}/otp/${otp}'>reset password</a>`,
    };
    const result = await transport.sendMail(details);
    console.log(result);
    return result;
  } catch (err) {
    console.log(err);
    return err;
  }
}

module.exports = mailer;