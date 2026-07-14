/** Persistent DOM host for Firebase invisible reCAPTCHA (phone auth). */
export function RecaptchaHost() {
  return (
    <div
      id="recaptcha-container"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    />
  );
}
