import morgan from 'morgan';

// Clean custom request logging format for development
export const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms');

