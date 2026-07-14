export class PhoneAlreadyRegisteredError extends Error {
  constructor() {
    super('This phone number is already registered.');
    this.name = 'PhoneAlreadyRegisteredError';
  }
}
