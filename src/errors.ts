const errorMessages: Record<string, string> = {
  account_unverified:
    "Your Hack Club account must be verified before you can sign in.",
  internal_server_error:
    "An error has occurred on the server! Please try again later.",
  apikey_creation_failed: "Failed to create the apikey due to a server error.",
  apikey_doesnt_exist: "Request was attempted on a non-existing api key.",
  apikey_update_failed: "Failed to update the api key due to a server error.",
};

export default errorMessages;
