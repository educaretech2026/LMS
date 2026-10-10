const privateKeyInput = `-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDOuRnsbXERdLmw\\nXwuuCRY73jnYjMOp8sV94GyVPmZ8M4bQPIMnpdvuYEfWpaW6PT4P3gtuM/b8+126\\nzwwP3A5EMZoM1HhJLQIIejWn/sFYGlGNfCagLMJfrRqjAHl7jJegMLiw1CwH9Tkc\\ndTMjF5EEBqSo/8uxJYjiaHyTPjCN5y2nohx1FtKkP75v8t6PEP5ZCZMB61H3htgY\\n7m7fvpMCyVtoKnozpmHWe9TYP1t7IYZbLDuxW0MYFPVf0yDL82BPm4FzdV+To837\\nMsZJkEF+5sqi70F3dF4rFdzlgV8WJNXy5O5PerO3kler/UnCrmmAFZmZSt+3XzB2\\nATLgmZqlAgMBAAECggEAKaKXSYqLVNA1HAQwlodG/pzV+rrzJ5X5V85tICv2uTop\\ng2REqCYcIykqHt2zAM0X5Fs84x+9NZus95R+4ezYxLxWwhHC/j395FY021aQe12l\\nokDoiKcrKNj0/fJ5BTy+Rym48Qhyq9GkhIpIV9+FuhFadZ07WbztEmin+oHyhom1\\n8LuopwSWQJ0ssXpulePa0zgWS9N9uDfB8/15xd0K6bQuYQDNPfA5KkyxV/93Y0JP\\n+PktWhbXg9EWSCK8ST3v2tQlrnVb8ClXTho6mciImZcJt/bIcQv+QBUgu/ppC0rp\\n4aaGGnx/u5mdZ3qneqdCuf0du1+mR9Bj9rDNnnmQOwKBgQDsor5DxFJFM+gZT5Uk\\nN1M2ms4T5q2+ewcnS/hVHrylPQx1Jx7ArFlUH/rI3qTbhUdpXQZtLl6+HTSoaGSI\\n22StKOT8Y1+vjvVUbESHpYDFI+/DL9bJ5z5I7alAsxcoXPSLbZB4BPhhDu8Lk4e+\\n+BXEa2jDL+8HqSpHmb7waM1ZLwKBgQDfo7iFXhflV1+F42p6iaeZJ9kKBb7jo/Ur\\nqTzbYj+tE6KAbbBXir6FJRXoZseiKw6yiiA291nG11pUfMKmy+Mw2kdNAprJGF8V\\nWN4JWBRJyAS+rkTJI//8RwvfgQw8hzWaE5d5tsmdC4tB6Vktof+iBXGVIRi00OqL\\niBmkJNLsawKBgQDk8tCDYH741a/KTWVPFPg97KlWN+oCUaYqLyaltIdwmBBliOQI\\nJriG3CoYDtISUnE1T/vXxvWDm15HUjly8FIH93kVeFAr23UhqV7knwxnsM1ZW//E\\neSeaB9ep8ZyGQOmZvPf6J1TpEznVSXgdHIpy8Dj8IHR0RQfTHr3OfJexoQKBgEtj\\n+NdU4f9ZVgVfpcyLTSmPSlZbm39IDWVblv1qAIdLIDPlRlYsmo9t8hW3WEMt+rVr\\nZPLCrcwfWv8yU7hA8WTNoM2wPBfglGUw4SELRUOeHyNcwimAblJQbQs6iLJ67jHz\\nutO4L/02IArnLD36559p8GFSl+6UowzIo8Q2+bfjAoGAWcHYY+teCVg9Tml1O8Fy\\nfnsnUWHCH/wLUipKHWMXn7Mt4gGEImMAKwcA9UZewx8pMrVHQx40pGBQPGOsK5U8\\nnqyPkkH6xcvt+UYukqnLu5e1nz+lVaht0PW/c9DoZLB+1mHZ4S3IoInIpljr/Hej\\n03QEMEFbXMIfdf5tL0pQzJg=\\n-----END PRIVATE KEY-----\\n`;

let privateKey = privateKeyInput
  .replace(/^["']|["']$/g, '') 
  .replace(/\\n/g, '\n'); 

console.log("After basic replace:");
console.log(privateKey);

const match = privateKey.match(/-----BEGIN PRIVATE KEY-----(.*)-----END PRIVATE KEY-----/s);
if (match) {
  const body = match[1].replace(/\s+/g, ''); 
  const chunked = body.match(/.{1,64}/g)?.join('\n') || body;
  privateKey = `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----\n`;
}
console.log("After robust replace:");
console.log(privateKey);

const crypto = require('crypto');
try {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update('test');
  sign.sign(privateKey);
  console.log("Signature successful!");
} catch (e) {
  console.log("Error:", e);
}
