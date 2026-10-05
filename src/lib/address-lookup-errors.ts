export class AddressLookupUnavailableError extends Error {
  constructor(message = "Address lookup provider is not configured.") {
    super(message);
    this.name = "AddressLookupUnavailableError";
  }
}
