export class UnverifiedAccountError extends Error {
  constructor() {
    super("Your Hack Club account is not verified yet.");
    this.name = "UnverifiedAccountError";
  }
}