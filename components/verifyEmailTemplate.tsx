import * as React from 'react';

interface EmailTemplateProps {
  link: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  link,
}) => (
  <div>
    <h1>Confirm your account</h1>
    <p>Thank you for signing up for ESEFABRICS. To confirm your account, please follow the button below.</p>
    <a href={link}>Confirm Account</a>
    <br />
    <p>Regards,</p>
    <p>ESEFABRICS</p>
    <hr/>
    <br/>
  <p>if you&apos;re having trouble clicking the &quot;Confirm account&quot; button, copy and paste the URL below into your web browser: <a href={link}>{link}</a></p>
  </div>
);