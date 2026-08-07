export class UnverifiedAccountError extends Error {
  constructor() {
    super("Your Hack Club account is not verified yet.");
    this.name = "UnverifiedAccountError";
  }
}

export class APIError extends Error {
  status: number;
  constructor({ status, msg }: { status: number; msg: string }) {
    super(msg);
    this.name = "APIError";
    this.status = status;
  }
}
