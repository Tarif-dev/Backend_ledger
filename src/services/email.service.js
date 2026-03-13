const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const OAuth2 = google.auth.OAuth2

const oauth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
)

oauth2Client.setCredentials({
  refresh_token : process.env.REFRESH_TOKEN,
})

async function createTransport() {
  const accessToken = await oauth2Client.getAccessToken()

  const transporter =  nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL_USER,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN,
      accessToken : accessToken.token
    },
  });

  transporter.verify((error, success) => {
    if (error) {
      console.log("Error connecting to email server : ", error);
    } else {
      console.log("Email server is ready to send message");
    }
  });

  return transporter
}


const sendEmail = async (to, subject, text, html) => {
  try {
    const transporter = await createTransport()

    const info = await transporter.sendMail({
      from: `"Tarif"<${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Message sent : %s", info.messageId);
    console.log(("preview URL :", nodemailer.getTestMessageUrl(info)));
  } catch (error) {
    console.error("Error sending message : ", error);
  }
};

async function sendRegisterationEmail(userEmail, name) {
  const subject = "Welcome to Backend Legder family .";
  const text = `Hello ${name} , \n\n Thank you for registering at Backend ledger. We're excited to have you on board!\n\n Best regards,\nThe Backend Ledger team.`;
  const html = `<p>Hello ${name} ,</p><p> Thank you for registering at Backend ledger. We're excited to have you on board!</p><p> Best regards,<br>The Backend Ledger team.</p>`;
  await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionEmail(userEmail, name, amount, toAccount) {
  const subject = "Transaction Successful";
  const text = `Hello ${name} , \n\n Your transaction of amount ${amount} to account ${toAccount} has been successful.\n\n Best regards,\nThe Backend Ledger team.`;
  const html = `<p>Hello ${name} ,</p><p> Your transaction of amount ${amount} to account ${toAccount} has been successful.</p><p> Best regards,<br>The Backend Ledger team.</p>`;
  await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionFailureEmail(userEmail, name, amount, toAccount) {
  const subject = "Transaction Failed";
  const text = `Hello ${name} , \n\n We regret to inform you that your transaction of amount ${amount} to account ${toAccount} has failed. Please try again later or contact support for assistance.\n\n Best regards,\nThe Backend Ledger team.`;
  const html = `<p>Hello ${name} ,</p><p> We regret to inform you that your transaction of amount ${amount} to account ${toAccount} has failed. Please try again later or contact support for assistance.</p><p> Best regards,<br>The Backend Ledger team.</p>`;
  await sendEmail(userEmail, subject, text, html);
}   

module.exports = {
  sendRegisterationEmail,
  sendTransactionEmail,
  sendTransactionFailureEmail
};
