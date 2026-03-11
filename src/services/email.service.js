const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAUTH2",
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log("Error connecting to email server : ", error);
  } else {
    console.log("Email server is ready to send message");
  }
});

const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Tarif"<${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Message sent : %s", info.message);
    console.log(("preview URL : %s", nodemailer.getTestMessageUrl(info)));
  } catch (error) {
    console.error("Error sending message : ", error);
  }
};


async function sendRegisterationEmail(userEmail, name) {
    const subject = 'Welcome to Backend Legder family .'
    const text = `Hello ${name} , \n\n Thank you for registering at Backend ledger. We're excited to have you on board!\n\n Best regards,\nThe Backend Ledger team.`
    const html = `<p>Hello ${name} ,</p><p> Thank you for registering at Backend ledger. We're excited to have you on board!</p><p> Best regards,<br>The Backend Ledger team.</p>`
    await sendEmail(userEmail,subject,text,html)
}

module.exports = { sendRegisterationEmail };
