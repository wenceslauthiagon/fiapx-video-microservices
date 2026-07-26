declare module 'nodemailer' {
  namespace nodemailer {
    interface Transporter {
      sendMail(mailOptions: {
        from?: string;
        to?: string;
        subject?: string;
        text?: string;
        html?: string;
      }): Promise<unknown>;
    }

    function createTransport(options: Record<string, unknown>): Transporter;
  }

  export = nodemailer;
}
