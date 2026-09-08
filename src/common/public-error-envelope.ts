export interface PublicErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
