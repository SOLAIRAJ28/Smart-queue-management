import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create SMTP Transporter
// Fallback to console logger if credentials are missing
const getTransporter = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(port),
      secure: port.toString() === '465',
      auth: { user, pass }
    });
  }
  return null;
};

const transporter = getTransporter();

// Generic Email Dispatcher
export const sendEmail = async ({ to, subject, text, html }) => {
  const from = process.env.SMTP_FROM || '"ApexBank Smart Queue" <no-reply@apexbank.com>';
  
  if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, text, html });
      console.log(`[Notification Service] Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error(`[Notification Service] Error sending email to ${to}:`, error.message);
      return false;
    }
  } else {
    console.log('\n--- MOCK EMAIL NOTIFICATION ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${text}`);
    console.log('-------------------------------\n');
    return false;
  }
};

// Generic SMS Dispatcher
export const sendSMS = async ({ to, message }) => {
  console.log('\n--- SMS NOTIFICATION ---');
  console.log(`To: ${to}`);
  console.log(`Message: ${message}`);
  console.log('------------------------\n');
  return { success: true };
};

// Appointment Confirmation
export const sendAppointmentConfirmation = async (appointment, user) => {
  const dateStr = new Date(appointment.date).toLocaleDateString();
  const subject = 'Appointment Confirmed - ApexBank';
  const text = `Dear ${user.name},\n\nYour appointment has been scheduled successfully.\n\nBranch: ${appointment.branch?.name}\nService: ${appointment.service?.name}\nDate: ${dateStr}\nTime Slot: ${appointment.timeSlot}\n\nThank you for banking with ApexBank.`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-bottom: 20px;">Appointment Confirmed</h2>
      <p>Dear <strong>${user.name}</strong>,</p>
      <p>Your appointment has been scheduled successfully. Here are the details:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Branch</strong></td><td>${appointment.branch?.name}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Service</strong></td><td>${appointment.service?.name}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Date</strong></td><td>${dateStr}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><strong>Time Slot</strong></td><td>${appointment.timeSlot}</td></tr>
      </table>
      <p style="color: #64748b; font-size: 14px;">Please arrive 5 minutes before your time slot. You can check in at the kiosk using your registered phone number or email.</p>
    </div>
  `;

  await sendEmail({ to: user.email, subject, text, html });
  if (user.phone) {
    await sendSMS({ to: user.phone, message: `ApexBank: Appointment confirmed at ${appointment.branch?.name} on ${dateStr} at ${appointment.timeSlot}.` });
  }
};

// Appointment Cancellation
export const sendAppointmentCancellation = async (appointment, user) => {
  const dateStr = new Date(appointment.date).toLocaleDateString();
  const subject = 'Appointment Cancelled - ApexBank';
  const text = `Dear ${user.name},\n\nYour appointment scheduled for ${dateStr} during ${appointment.timeSlot} at our ${appointment.branch?.name} branch has been cancelled.\n\nIf you did not initiate this, please contact support.`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #ef4444; margin-bottom: 20px;">Appointment Cancelled</h2>
      <p>Dear <strong>${user.name}</strong>,</p>
      <p>Your appointment scheduled for <strong>${dateStr}</strong> during <strong>${appointment.timeSlot}</strong> at our <strong>${appointment.branch?.name}</strong> branch has been cancelled.</p>
      <p style="color: #64748b; font-size: 14px;">If you would like to reschedule, please visit your Customer Portal dashboard.</p>
    </div>
  `;

  await sendEmail({ to: user.email, subject, text, html });
  if (user.phone) {
    await sendSMS({ to: user.phone, message: `ApexBank: Appointment for ${dateStr} at ${appointment.branch?.name} was cancelled.` });
  }
};

// Virtual Token Created
export const sendTokenCreated = async (token, user) => {
  const subject = 'Lobby Queue Ticket - ApexBank';
  const text = `Dear ${user.name},\n\nYou have joined the queue at ${token.branch?.name}.\n\nYour Token: ${token.tokenNumber}\nService: ${token.service?.name}\nPriority: ${token.priority}\n\nYou can monitor your position live in your dashboard.`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #3b82f6; margin-bottom: 20px;">Virtual Token Issued</h2>
      <p>Dear <strong>${user.name}</strong>,</p>
      <p>You have successfully joined the lobby queue. Here is your virtual ticket details:</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <span style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Token Number</span>
        <h1 style="font-size: 48px; color: #0f172a; margin: 8px 0; font-weight: 800;">${token.tokenNumber}</h1>
        <p style="margin: 0; color: #334155; font-weight: 600;">${token.service?.name}</p>
      </div>
      <p>Branch: ${token.branch?.name}</p>
      <p style="color: #64748b; font-size: 14px;">We will notify you via SMS when you are close to being called.</p>
    </div>
  `;

  await sendEmail({ to: user.email, subject, text, html });
  if (user.phone) {
    await sendSMS({ to: user.phone, message: `ApexBank: Token ${token.tokenNumber} issued at ${token.branch?.name}. Track live on your portal.` });
  }
};

// Queue Position Alert (e.g. 1 person ahead)
export const sendTokenPositionReminder = async (token, user, position) => {
  const subject = 'Lobby Queue Alert - ApexBank';
  const text = `Dear ${user.name},\n\nThis is a friendly reminder that you are at position ${position} in the queue for token ${token.tokenNumber}.\n\nPlease make sure you are in the lobby area.`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #ca8a04; margin-bottom: 20px;">Queue Alert: You are Next!</h2>
      <p>Dear <strong>${user.name}</strong>,</p>
      <p>Your token <strong>${token.tokenNumber}</strong> is currently at position <strong>#${position}</strong> in the lobby queue.</p>
      <p>Please make sure you are present in the lobby. The teller will be calling your number shortly.</p>
    </div>
  `;

  await sendEmail({ to: user.email, subject, text, html });
  if (user.phone) {
    await sendSMS({ to: user.phone, message: `ApexBank: Your token ${token.tokenNumber} is next! Please proceed to the lobby area.` });
  }
};

// Token Called (proceed to counter)
export const sendTokenCalled = async (token, user, counterNumber) => {
  const subject = 'Your Token is Being Called - ApexBank';
  const text = `Dear ${user.name},\n\nYour token ${token.tokenNumber} is being called at Counter ${counterNumber}.\n\nPlease proceed to the counter immediately.`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #16a34a; margin-bottom: 20px;">Please Proceed to Counter ${counterNumber}</h2>
      <p>Dear <strong>${user.name}</strong>,</p>
      <p>Your token <strong>${token.tokenNumber}</strong> is currently being called.</p>
      <div style="background-color: #f0fdf4; border: 1px dashed #16a34a; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
        <span style="font-size: 12px; color: #16a34a; text-transform: uppercase; font-weight: bold;">Proceed To</span>
        <h1 style="font-size: 40px; color: #14532d; margin: 8px 0; font-weight: 800;">Counter ${counterNumber}</h1>
        <p style="margin: 0; color: #166534; font-weight: 600;">Token: ${token.tokenNumber}</p>
      </div>
    </div>
  `;

  await sendEmail({ to: user.email, subject, text, html });
  if (user.phone) {
    await sendSMS({ to: user.phone, message: `ApexBank: Token ${token.tokenNumber} is called. Proceed to Counter ${counterNumber}.` });
  }
};


